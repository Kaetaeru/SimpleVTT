import type { RulesProfileLike } from "../../src/domain/profileEngine";
import type { RulesRuntimeState } from "../../src/domain/combatState";
import { beginTurn } from "../../src/domain/turnEconomy";

export const TEST_PROFILE: RulesProfileLike = {
  profileId:"dnd.srd-5.2.1",
  roundingPolicy:{ id:"dnd.rounding.default-floor", default:"floor" },
  properties:{},
  d20Test:{ advantageDisadvantage:{ sameSideStacks:false, opposingCancel:true } },
};

export function runtimeState(): RulesRuntimeState {
  return {
    revision:0,
    clock:{ round:1, elapsedSeconds:0 },
    combatants:{
      hero:{
        id:"hero",
        baseSpeed:30,
        life:{
          hp:{ current:20, maximum:20, temporary:0 },
          deathSaves:{ successes:0, failures:0 },
          stable:false,
          unconscious:false,
          dead:false,
        },
        economy:beginTurn(30),
        resources:[
          { id:"spell-slot-1", label:"1레벨 주문 슬롯", current:2, maximum:2, recovery:{ longRest:"all" } },
          { id:"short-resource", label:"Short Resource", current:0, maximum:2, recovery:{ shortRest:"all" } },
          { id:"turn-resource", label:"Turn Resource", current:0, maximum:1, recovery:{ turnStart:"all" } },
        ],
        hitDice:[{ id:"hero-d8", sides:8, current:1, maximum:1 }],
      },
      goblin:{
        id:"goblin",
        baseSpeed:30,
        life:{
          hp:{ current:15, maximum:15, temporary:0 },
          deathSaves:{ successes:0, failures:0 },
          stable:false,
          unconscious:false,
          dead:false,
        },
        economy:beginTurn(30),
        resources:[],
        hitDice:[{ id:"goblin-d6", sides:6, current:1, maximum:1 }],
      },
    },
    effects:[],
    concentration:{},
    history:[],
  };
}
