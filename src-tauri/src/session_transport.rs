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
const PEER_LIFECYCLE_EVENT: &str = "session-transport-peer-lifecycle";
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

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct TransportPeerLifecycleDto {
    peer: String,
    state: String,
}

struct PeerWriter {
    peer: String,
    stream: TcpStream,
}

struct RunningTransport {
    role: TransportRole,
    address: String,
    connection_state: Arc<Mutex<String>>,
    stop: Arc<AtomicBool>,
    writers: Arc<Mutex<Vec<PeerWriter>>>,
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

fn disconnected_peer(peer: &str) -> TransportPeerLifecycleDto {
    TransportPeerLifecycleDto {
        peer: peer.to_owned(),
        state: "disconnected".into(),
    }
}

fn emit_state(app: &AppHandle, status: &TransportStatusDto) {
    let _ = app.emit(STATE_EVENT, status.clone());
}

fn peer_count(writers: &Arc<Mutex<Vec<PeerWriter>>>) -> usize {
    writers.lock().map(|entries| entries.len()).unwrap_or(0)
}

fn set_connection_state(connection_state: &Arc<Mutex<String>>, state: &str) {
    if let Ok(mut current) = connection_state.lock() {
        *current = state.to_owned();
    }
}

fn spawn_reader(
    app: AppHandle,
    stream: TcpStream,
    peer: String,
    role: TransportRole,
    address: String,
    connection_state: Arc<Mutex<String>>,
    stop: Arc<AtomicBool>,
    writers: Arc<Mutex<Vec<PeerWriter>>>,
) {
    thread::spawn(move || {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
        let mut reader = BufReader::new(stream);
        loop {
            if stop.load(Ordering::Relaxed) {
                return;
            }
            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => break,
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
                        break;
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
                Err(_) => break,
            }
        }

        if stop.load(Ordering::Relaxed) {
            return;
        }
        if let Ok(mut peers) = writers.lock() {
            peers.retain(|entry| entry.peer != peer);
        }
        let _ = app.emit(PEER_LIFECYCLE_EVENT, disconnected_peer(&peer));
        let next_state = if role == TransportRole::Client {
            set_connection_state(&connection_state, "disconnected");
            "disconnected"
        } else {
            "connected"
        };
        emit_state(
            &app,
            &TransportStatusDto {
                role: Some(role),
                state: next_state.into(),
                address,
                peer_count: peer_count(&writers),
            },
        );
    });
}

impl SessionTransportState {
    pub fn status(&self) -> Result<TransportStatusDto, String> {
        let guard = self.inner.lock().map_err(|_| "session transport lock poisoned".to_string())?;
        if let Some(runtime) = guard.as_ref() {
            let state = runtime
                .connection_state
                .lock()
                .map_err(|_| "session transport state lock poisoned".to_string())?
                .clone();
            Ok(TransportStatusDto {
                role: Some(runtime.role),
                state,
                address: runtime.address.clone(),
                peer_count: peer_count(&runtime.writers),
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
            set_connection_state(&runtime.connection_state, "disconnected");
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
        let connection_state = Arc::new(Mutex::new("connected".to_owned()));
        let stop = Arc::new(AtomicBool::new(false));
        let writers = Arc::new(Mutex::new(Vec::<PeerWriter>::new()));
        let accept_stop = stop.clone();
        let accept_writers = writers.clone();
        let accept_state = connection_state.clone();
        let accept_address = address.clone();
        let accept_app = app.clone();

        thread::spawn(move || {
            while !accept_stop.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((stream, peer_addr)) => {
                        let peer = peer_addr.to_string();
                        let _ = stream.set_nodelay(true);
                        let writer = match stream.try_clone() {
                            Ok(writer) => writer,
                            Err(_) => continue,
                        };
                        if let Ok(mut peers) = accept_writers.lock() {
                            peers.push(PeerWriter { peer: peer.clone(), stream: writer });
                        }
                        emit_state(
                            &accept_app,
                            &TransportStatusDto {
                                role: Some(TransportRole::Host),
                                state: "connected".into(),
                                address: accept_address.clone(),
                                peer_count: peer_count(&accept_writers),
                            },
                        );
                        spawn_reader(
                            accept_app.clone(),
                            stream,
                            peer,
                            TransportRole::Host,
                            accept_address.clone(),
                            accept_state.clone(),
                            accept_stop.clone(),
                            accept_writers.clone(),
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
            connection_state,
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
        let connection_state = Arc::new(Mutex::new("connected".to_owned()));
        let stop = Arc::new(AtomicBool::new(false));
        let writers = Arc::new(Mutex::new(vec![PeerWriter { peer: address.to_owned(), stream: writer }]));
        spawn_reader(
            app.clone(),
            stream,
            address.to_owned(),
            TransportRole::Client,
            address.to_owned(),
            connection_state.clone(),
            stop.clone(),
            writers.clone(),
        );

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
            connection_state,
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
        writers.retain_mut(|entry| match entry.stream.write_all(&frame) {
            Ok(()) => {
                sent += 1;
                true
            }
            Err(_) => false,
        });
        Ok(sent)
    }

    pub fn send_to(&self, peer: &str, message: &str) -> Result<usize, String> {
        let frame = frame_message(message)?;
        let guard = self.inner.lock().map_err(|_| "session transport lock poisoned".to_string())?;
        let runtime = guard.as_ref().ok_or_else(|| "session transport is not connected".to_string())?;
        let mut writers = runtime
            .writers
            .lock()
            .map_err(|_| "session transport writers lock poisoned".to_string())?;
        let entry = writers
            .iter_mut()
            .find(|entry| entry.peer == peer)
            .ok_or_else(|| format!("session transport peer is not connected: {peer}"))?;
        entry
            .stream
            .write_all(&frame)
            .map_err(|error| format!("failed to send session frame to {peer}: {error}"))?;
        Ok(1)
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

    #[test]
    fn disconnected_peer_event_preserves_exact_transport_identity() {
        assert_eq!(
            disconnected_peer("127.0.0.1:54321"),
            TransportPeerLifecycleDto {
                peer: "127.0.0.1:54321".into(),
                state: "disconnected".into(),
            }
        );
    }
}
