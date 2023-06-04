interface IObjectsToGet {
  skills: number[]
  traits: number[]
  items: number[]
  specializations: number[]
  pets: number[]
  pvp_amulets: number[]
}

interface Duration {
  secs: number
  nanos: number
}

interface Fact {
  type: string
  text?: string
  icon?: string
  hit_count?: number
  dmg_multiplier?: number
  order?: number
  buff?: number
  apply_count?: number
  duration?: Duration
  value?: number
  percent?: number
  requires_trait?: number[]
  distance?: number
  defiance_break?: number
  attribute_multiplier?: number
  level_exponent?: number
  level_multiplier?: number
  field_type?: string
  finisher_type?: string
  target?: string
}

interface FactsOverride {
  mode: string
  facts: Fact[]
}

interface Slot {
  profession: string
  slot: string
  next_chain: number
}

interface Palette {
  id: number
  type: string
  weapon_type: string
  slots: Slot[]
}

interface Activation {
  secs: number
  nanos: number
}
interface RechargeOverride {
  mode: string
  recharge: Duration
}

interface Modifier {
  id: number
  base_amount: number
  formula_param1: number
  formula_param2: number
  formula: number
  description: string
  flags: string[]
  trait_req?: number
  mode?: 'Pve' | 'Pvp' | 'Wvw'
}

interface Skill {
  id: number
  name: string
  description: string
  icon: string
  chat_link: string
  facts: Fact[]
  facts_override: FactsOverride[]
  categories: any[]
  range: number
  recharge: Duration
  recharge_override: RechargeOverride[]
  activation: Activation
  palettes: Palette[]
  sub_skills: number[]
  modifiers: Modifier[]
}
