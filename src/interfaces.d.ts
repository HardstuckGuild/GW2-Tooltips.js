interface Stats {
  level          : number
  power          : number
  toughness      : number
  vitality       : number
  precision      : number
  ferocity       : number
  conditionDamage: number
  expertise      : number
  concentration  : number
  healing        : number
  critDamage     : number
}
interface Context {
  traits   : any[]
  gameMode : GameMode
  stats    : Stats
}

// legacy gw2object types
type ObjectType = 'skill' | 'trait' | 'item' | 'specialization' | 'pet' | 'pvp/amulet' | 'specialization';
type ObjectDataStorage<T> = {
  [k in ObjectType as `${k}s`] : T
}

interface Duration {
  secs  : number
  nanos : number
}

interface BasicFact<Type> {
  type            : Type
  order           : number
  requires_trait? : number[]
  defiance_break? : number
  overrides?      : number

  [k : string] : undefined
}

interface BuffFact extends BasicFact<'Buff'> {
  icon        : string
  buff        : number
  apply_count : number
  duration    : Duration
}
interface BuffBriefFact extends BasicFact<'BuffBrief'> {
  text : string
  buff : number
}
interface PrefixedBuffBriefFact extends BasicFact<'PrefixedBuffBrief'>{
  icon   : string
  buff   : number
  prefix : number
}
interface TimeFact extends BasicFact<'Time'> {
  text     : string
  icon     : string
  duration : Duration;
}
interface DistanceFact extends BasicFact<'Distance'> {
  text     : string
  icon     : string
  distance : number
}
interface NumberFact extends BasicFact<'Number'> {
  text  : string
  icon  : string
  value : number
}
type ComboFieldType = 'Water' | 'Fire' // incomplete
interface ComboFieldFact extends BasicFact<'ComboField'> {
  text       : string
  icon       : string
  field_type : ComboFieldType
}
type ComboFinisherType = "Blast" | "Projectile" // incomplete
interface ComboFinisherFact extends BasicFact<'ComboFinisher'> {
  text          : string
  icon          : string
  finisher_type : ComboFinisherType
}
interface NoDataFact extends BasicFact<'NoData'> {
  text : string
  icon : string
}
interface DamageFact extends BasicFact<'Damage'> {
  text           : string
  icon           : string
  hit_count      : number
  dmg_multiplier : number
}
interface PercentFact extends BasicFact<'Percent'> {
  text    : string
  icon    : string
  percent : number
}
interface AttributeAdjustFact extends BasicFact<'AttributeAdjust'> {
  text                 : string
  icon                 : string
  value                : number
  target               : Capitalize<keyof Stats>,
  attribute_multiplier : number
  level_exponent       : number
  level_multiplier     : number
  hit_count            : number
}
interface StunBreakFact extends BasicFact<'StunBreak'> {
  icon  : string
  value : true
}

type FactMap = {
  Buff              : BuffFact 
  BuffBrief         : BuffBriefFact 
  PrefixedBuffBrief : PrefixedBuffBriefFact
  Time              : TimeFact 
  Distance          : DistanceFact 
  Number            : NumberFact 
  ComboField        : ComboFieldFact 
  ComboFinisher     : ComboFinisherFact 
  NoData            : NoDataFact 
  Damage            : DamageFact 
  Percent           : PercentFact 
  AttributeAdjust   : AttributeAdjustFact 
  StunBreak         : StunBreakFact;
}

type FactType = keyof FactMap;
type Fact = FactMap[keyof FactMap];

interface FactsOverride {
  mode  : string
  facts : Fact[]
}

interface Slot {
  profession : string
  slot       : string
  next_chain : number
}

type WeaponType = 'None' | 'Focus' | 'Shield' | 'Torch' | 'Warhorn' | 'Greatsword' | 'Hammer' | 'Staff' | 'BowLong' | 'Rifle' | 'BowShort' | 'Axe' | 'Sword' | 'Dagger' | 'Pistol' | 'Scepter' | 'Mace' | 'Standard';

interface Palette {
  id          : number
  type        : 'Standard' | 'Toolbelt' | 'Bundle' | 'Equipment' | 'Heal' | 'Elite' | 'Profession' | 'Monster'
  weapon_type : WeaponType
  slots       : Slot[]
}

interface Activation {
  secs  : number
  nanos : number
}
interface RechargeOverride {
  mode     : string
  recharge : Duration
}

type GameMode = 'Pve' | 'Pvp' | 'Wvw';

interface Modifier {
  id             : number
  base_amount    : number
  formula_param1 : number
  formula_param2 : number
  formula        : number
  description    : string
  flags          : ('FormatDuration' | 'FormatPercent' | 'MulByDuration' | 'NonStacking')[]
  trait_req?     : number
  mode?          : GameMode
}

interface Skill {
  id                : number
  name              : string
  description       : string
  icon              : string
  chat_link         : string
  facts             : Fact[]
  facts_override?   : FactsOverride[]
  categories        : any[]
  range             : number
  recharge          : Duration
  recharge_override : RechargeOverride[]
  activation        : Activation
  palettes          : Palette[]
  sub_skills?       : number[]
  modifiers         : Modifier[]
}

interface HandlerParams<TFact = Fact>  {
  fact    : TFact
  buff    : (TFact extends { buff : number } ? Skill : undefined) | undefined
  skill   : Skill
}
