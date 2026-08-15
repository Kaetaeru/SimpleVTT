import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/characterCreationCompleteAdapter'
import './app/characterSheetCompleteAdapter'
import './app/mockAdapterComplete'
import './app/spellcastingRuntimeAdapter'
import './app/progressionRuntimeAdapter'
import './app/sorceryRuntimeAdapter'
import './app/progressionPhase08SorcererAdapter'
import './app/progressionPhase08WarlockAdapter'
import './app/progressionPersistentFeatureAdapter'
import './app/progressionPhase08EpicBoonAdapter'
import './app/progressionPhase08WeaponMasteryAdapter'
import './app/progressionPhase08FighterStyleAdapter'
import './app/progressionPhase08BarbarianPrimalKnowledgeAdapter'
import './app/progressionPhase08SubclassAdapter'
import './app/progressionPhase08WizardEvocationAdapter'
import './app/progressionPhase08MonkOpenHandAdapter'
import './app/subclassRuntimeAdapter'
import './app/warlockPactTomeRuntimeAdapter'
import './app/druidCircleLandSpellRuntimeAdapter'
import './app/restSpellManagementRuntimeAdapter'
import './app/classFeatureSpellRuntimeAdapter'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
