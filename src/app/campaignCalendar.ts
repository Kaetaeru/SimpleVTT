import type { CampaignCalendarDateTime, CampaignCalendarState } from "./campaignPersistenceContracts";

const GREGORIAN_MONTHS=[
  {id:"1",label:"1월",days:31},{id:"2",label:"2월",days:28},{id:"3",label:"3월",days:31},
  {id:"4",label:"4월",days:30},{id:"5",label:"5월",days:31},{id:"6",label:"6월",days:30},
  {id:"7",label:"7월",days:31},{id:"8",label:"8월",days:31},{id:"9",label:"9월",days:30},
  {id:"10",label:"10월",days:31},{id:"11",label:"11월",days:30},{id:"12",label:"12월",days:31},
] as const;

export const GREGORIAN_CALENDAR_MONTHS=GREGORIAN_MONTHS.map((month)=>({...month}));
export function isGregorianLeapYear(year:number){return year%4===0&&(year%100!==0||year%400===0);}
export function gregorianMonthDays(year:number,month:number){
  if(month<1||month>12||!Number.isInteger(month)) throw new Error("월은 1월부터 12월 사이여야 합니다.");
  return month===2&&isGregorianLeapYear(year)?29:GREGORIAN_MONTHS[month-1].days;
}
function daysBeforeGregorianYear(year:number){const complete=year-1;return complete*365+Math.floor(complete/4)-Math.floor(complete/100)+Math.floor(complete/400);}
function assertClock(hour:number,minute:number){
  if(!Number.isInteger(hour)||hour<0||hour>23) throw new Error("시간은 0시부터 23시 사이여야 합니다.");
  if(!Number.isInteger(minute)||minute<0||minute>59) throw new Error("분은 0분부터 59분 사이여야 합니다.");
}

export function campaignDateTimeToAbsoluteMinute(providerId:string,input:CampaignCalendarDateTime){
  if(!input.era.trim()) throw new Error("연호를 입력하세요.");
  if(!Number.isInteger(input.year)||input.year<1) throw new Error("연도는 1 이상의 정수여야 합니다.");
  if(!Number.isInteger(input.day)||input.day<1) throw new Error("날짜는 1 이상의 정수여야 합니다.");
  assertClock(input.hour,input.minute);
  if(providerId==="builtin.simple-day") return (input.day-1)*1440+input.hour*60+input.minute;
  if(providerId!=="builtin.gregorian") throw new Error(`지원되지 않는 달력 공급자입니다: ${providerId}`);
  const month=Number(input.monthId);const maxDay=gregorianMonthDays(input.year,month);
  if(input.day>maxDay) throw new Error(`${input.year}년 ${month}월은 ${maxDay}일까지입니다.`);
  let days=daysBeforeGregorianYear(input.year);
  for(let current=1;current<month;current+=1) days+=gregorianMonthDays(input.year,current);
  days+=input.day-1;
  return days*1440+input.hour*60+input.minute;
}

function gregorianDateFromDayIndex(dayIndex:number){
  let low=1;let high=Math.max(2,Math.floor(dayIndex/365)+2);
  while(daysBeforeGregorianYear(high)<=dayIndex) high*=2;
  while(low<high){const middle=Math.floor((low+high+1)/2);if(daysBeforeGregorianYear(middle)<=dayIndex) low=middle;else high=middle-1;}
  const year=low;let remaining=dayIndex-daysBeforeGregorianYear(year);let month=1;
  while(remaining>=gregorianMonthDays(year,month)){remaining-=gregorianMonthDays(year,month);month+=1;}
  return {year,month,day:remaining+1};
}

export function projectCampaignCalendar(providerId:string,absoluteMinute:number,era="서력"):CampaignCalendarState["displayAnchor"]{
  if(!Number.isInteger(absoluteMinute)||absoluteMinute<0) throw new Error("절대 시간은 0 이상의 정수 분이어야 합니다.");
  const dayIndex=Math.floor(absoluteMinute/1440);const minuteOfDay=absoluteMinute%1440;
  const hour=Math.floor(minuteOfDay/60);const minute=minuteOfDay%60;
  if(providerId==="builtin.simple-day") return {era,year:1,monthId:"day",monthLabel:"Day",day:dayIndex+1,hour,minute};
  if(providerId!=="builtin.gregorian") return {era,year:1,monthId:"1",day:dayIndex+1,hour,minute};
  const date=gregorianDateFromDayIndex(dayIndex);
  return {era,year:date.year,monthId:String(date.month),monthLabel:GREGORIAN_MONTHS[date.month-1].label,day:date.day,hour,minute};
}

export function formatCampaignCalendarDateTime(providerId:string,anchor:CampaignCalendarState["displayAnchor"]){
  const hour=String(anchor.hour??0).padStart(2,"0");const minute=String(anchor.minute??0).padStart(2,"0");
  if(providerId==="builtin.simple-day") return `Day ${anchor.day??1} · ${hour}:${minute}`;
  const era=anchor.era?.trim()||"연호 없음";const month=anchor.monthLabel??`${anchor.monthId??"1"}월`;
  return `${era} ${anchor.year??1}년 ${month} ${anchor.day??1}일 · ${hour}:${minute}`;
}
