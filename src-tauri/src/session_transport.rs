use serde::Serialize;
use std::{
    io::{BufRead, BufReader, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

const MESSAGE_EVENT: &str = "session-transport-message";
const STATE_EVENT: &str = "session-transport-state";
const MAX_FRAME_BYTES: usize = 1024 * 1024;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TransportRole {
    Host,
    Client,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransportStatusDto {
    pub role: Option<TransportRole>,
    pub state: String,
    pub address: String,
    pub peer_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransportMessageDto {
    peer: String,
    message: String,
}

struct RunningTransport {
    role: TransportRole,
    address: String,
    stop: Arc<AtomicBool>,
    writers: Arc<Mutex<Vec<TcpStream>>>,
}

#[derive(Default)]
pub struct SessionTransportState {
    inner: Mutex<Option<RunningTransport>>,
}

fn frame_message(message: &str) -> Result<Vec<u8>, String> {
    if message.is_empty() {
        return Err("session transport refuses an empty frame".into());
    }
    if message.contains('\n') || message.contains('\r') {
        return Err("session transport frame must be one JSON line without raw newline characters".into());
    }
    if message.len() > MAX_FRAME_BYTES {
        return Err(format!("session transport frame exceeds {MAX_FRAME_BYTES} bytes"));
    }
    let mut bytes = Vec::with_capacity(message.len() + 1);
    bytes.extend_from_slice(message.as_bytes());
    bytes.push(b'\n');
    Ok(bytes)
}

fn emit_state(app: &AppHandle, status: &TransportStatusDto) {
    let _ = app.emit(STATE_EVENT, status.clone());
}

fn spawn_reader(app: AppHandle, stream: TcpStream, peer: String, stop: Arc<AtomicBool>) {
    thread::spawn(move || {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
        let mut reader = BufReader::new(stream);
        loop {
            if stop.load(Ordering::Relaxed) {
                return;
            }
            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => return,
                Ok(_) => {
                    let line = line.trim_end_matches(['\r', '\n']);
                    if line.is_empty() {
                        continue;
                    }
                    if line.len() > MAX_FRAME_BYTES {
                        let _ = app.emit(
                            MESSAGE_EVENT,
                            TransportMessageDto {
                                peer: peer.clone(),
                                message: "{\"type\":\"transport-error\",\"message\":\"frame-too-large\"}".into(),
                            },
                        );
                        return;
                    }
                    let _ = app.emit(
                        MESSAGE_EVENT,
                        TransportMessageDto {
                            peer: peer.clone(),
                            message: line.to_owned(),
                        },
                    );
                }
                Err(error)
                    if matches!(
                        error.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) => {}
                Err(_) => return,
            }
        }
    });
}

impl SessionTransportState {
    pub fn status(&self) -> Result<TransportStatusDto, String> {
        let guard = self.inner.lock().map_err(|_| "session transport lock poisoned".to_string())?;
        if let Some(runtime) = guard.as_ref() {
            let peer_count = runtime
                .writers
                .lock()
                .map_err(|_| "session transport writers lock poisoned".to_string())?
                .len();
            Ok(TransportStatusDto {
                role: Some(runtime.role),
                state: "connected".into(),
                address: runtime.address.clone(),
                peer_count,
            })
        } else {
            Ok(TransportStatusDto {
                role: None,
                state: "disconnected".into(),
                address: String::new(),
                peer_count: 0,
            })
        }
    }

    pub fn stop(&self, app: &AppHandle) -> Result<TransportStatusDto, String> {
        let mut guard = self.inner.lock().map_err(|_| "session transport lock poisoned".to_string())?;
        if let Some(runtime) = guard.take() {
            runtime.stop.store(true, Ordering::Relaxed);
            if let Ok(mut writers) = runtime.writers.lock() {
                writers.clear();
            }
        }
        let status = TransportStatusDto {
            role: None,
            state: "disconnected".into(),
            address: String::new(),
            peer_count: 0,
        };
        emit_state(app, &status);
        Ok(status)
    }

    pub fn start_host(&self, app: &AppHandle, bind_address: &str) -> Result<TransportStatusDto, String> {
        self.stop(app)?;
        let listener = TcpListener::bind(bind_address)
            .map_err(|error| format!("failed to bind session host at {bind_address}: {error}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|error| format!("failed to configure session listener: {error}"))?;
        let address = listener
            .local_addr()
            .map_err(|error| format!("failed to read session listener address: {error}"))?
            .to_string();
        let stop = Arc::new(AtomicBool::new(false));
        let writers = Arc::new(Mutex::new(Vec::<TcpStream>::new()));
        let accept_stop = stop.clone();
        let accept_writers = writers.clone();
        let accept_app = app.clone();

        thread::spawn(move || {
            while !accept_stop.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((stream, peer_addr)) => {
                        let _ = stream.set_nodelay(true);
                        let writer = match stream.try_clone() {
                            Ok(writer) => writer,
                            Err(_) => continue,
                        };
                        if let Ok(mut peers) = accept_writers.lock() {
                            peers.push(writer);
                        }
                        spawn_reader(
                            accept_app.clone(),
                            stream,
                            peer_addr.to_string(),
                            accept_stop.clone(),
                        );
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(25));
                    }
                    Err(_) => return,
                }
            }
        });

        let status = TransportStatusDto {
            role: Some(TransportRole::Host),
            state: "connected".into(),
            address: address.clone(),
            peer_count: 0,
        };
        let mut guard = self.inner.lock().map_err(|_| "session transport lock poisoned".to_string())?;
        *guard = Some(RunningTransport {
            role: TransportRole::Host,
            address,
            stop,
            writers,
        });
        emit_state(app, &status);
        Ok(status)
    }

    pub fn connect_client(&self, app: &AppHandle, address: &str) -> Result<TransportStatusDto, String> {
        self.stop(app)?;
        let stream = TcpStream::connect(address)
            .map_err(|error| format!("failed to connect session client to {address}: {error}"))?;
        let _ = stream.set_nodelay(true);
        let writer = stream
            .try_clone()
            .map_err(|error| format!("failed to clone session client stream: {error}"))?;
        let stop = Arc::new(AtomicBool::new(false));
        let writers = Arc::new(Mutex::new(vec![writer]));
        spawn_reader(app.clone(), stream, address.to_owned(), stop.clone());

        let status = TransportStatusDto {
            role: Some(TransportRole::Client),
            state: "connected".into(),
            address: address.to_owned(),
            peer_count: 1,
        };
        let mut guard = self.inner.lock().map_err(|_| "session transport lock poisoned".to_string())?;
        *guard = Some(RunningTransport {
            role: TransportRole::Client,
            address: address.to_owned(),
            stop,
            writers,
        });
        emit_state(app, &status);
        Ok(status)
    }

    pub fn send(&self, message: &str) -> Result<usize, String> {
        let frame = frame_message(message)?;
        let guard = self.inner.lock().map_err(|_| "session transport lock poisoned".to_string())?;
        let runtime = guard.as_ref().ok_or_else(|| "session transport is not connected".to_string())?;
        let mut writers = runtime
            .writers
            .lock()
            .map_err(|_| "session transport writers lock poisoned".to_string())?;
        let mut sent = 0usize;
        writers.retain_mut(|stream| match stream.write_all(&frame) {
            Ok(()) => {
                sent += 1;
                true
            }
            Err(_) => false,
        });
        Ok(sent)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_are_newline_delimited_without_mutating_json() {
        let frame = frame_message("{\"type\":\"hello\",\"value\":1}").unwrap();
        assert_eq!(frame, b"{\"type\":\"hello\",\"value\":1}\n");
    }

    #[test]
    fn raw_newlines_and_oversized_frames_are_rejected() {
        assert!(frame_message("{\n}").is_err());
        assert!(frame_message(&"x".repeat(MAX_FRAME_BYTES + 1)).is_err());
    }
}
