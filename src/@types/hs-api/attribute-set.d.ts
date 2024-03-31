namespace API {
	type AttributeSet = {
		id         : number
		name       : string
		attributes : {
			attribute  : BaseAttribute
			base_value : number
			scaling    : number
		}[]
		similar_sets? : {
			[attribute in (Items.Weapon | Items.Trinket | Items.Armor)['subtype']]?: number
		}
	}
}