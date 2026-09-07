/** A refused table command: what was refused and why, in the rules' words, in Korean (TABLE_RUNTIME.md §2.5). */
export interface TableRefusal {
  code:string;
  message:string;
  actorId?:string;
  actionId?:string;
}

export type Refused={status:"refused";refusal:TableRefusal};

export function refused(code:string,message:string,extra:Partial<Pick<TableRefusal,"actorId"|"actionId">>={}):Refused {
  return {status:"refused",refusal:{code,message,...extra}};
}

/** The domain kernel's rejection texts, in the rules' words. */
export function kernelErrorKo(error:string|undefined):string {
  const text=String(error??"").trim();
  if(!text) return "행동이 처리되지 않았습니다.";
  if(/[가-힣]/.test(text)) return text;
  if(/^action is not available|action slot is not available|no action available/i.test(text)) return "행동을 이미 사용했습니다.";
  if(/bonus[- ]action/i.test(text)&&/not available|already|no /i.test(text)) return "추가 행동을 이미 사용했습니다.";
  if(/reaction/i.test(text)&&/not available|already|no /i.test(text)) return "반응을 이미 사용했습니다.";
  if(/blocked by condition/i.test(text)) return "행동불능 상태라 행동할 수 없습니다.";
  if(/revision mismatch/i.test(text)) return "테이블 상태가 바뀌었습니다. 다시 시도하세요.";
  if(/temporarily unavailable/i.test(text)) return "지금 장면에 없는 대상입니다.";
  if(/relation .* is not allowed/i.test(text)) return "그 대상에게는 사용할 수 없습니다.";
  if(/requires .* target|selected \d+; requires/i.test(text)) return "대상 수가 맞지 않습니다.";
  if(/death saving throws require 0 HP/i.test(text)) return "HP가 0일 때만 죽음 내성을 굴립니다.";
  if(/stable creatures do not make death saving throws/i.test(text)) return "이미 안정된 상태입니다.";
  if(/dead creatures/i.test(text)) return "죽은 대상입니다.";
  if(/resource .* insufficient|not enough|insufficient/i.test(text)) return "자원이 부족합니다.";
  if(/immune/i.test(text)) return "면역인 대상입니다.";
  return `규칙 거부 · ${text}`;
}
