use uuid::Uuid;

use crate::{App, defs, api::{self, skill::{ContextGroup, ContextOverride}}, Error};

impl App<'_> {
	pub fn convert_trait(&self, id: Uuid) -> Result<api::r#trait::Trait, Error> {
		let _trait = self.traits.get(&id).ok_or(Error::SkillNotFound(id.to_string()))?;

		let mut description = _trait.text_description.maybe_as_string(&self.db);
		let mut name_brief = None;
		let mut description_brief = None;
		let mut base_context = ContextGroup::default();
		let mut override_groups = Vec::new();
		let mut provides_weapon_access = Vec::new();

		match &_trait.detail {
			defs::r#trait::Detail::Buff(buff) => {
				let skill = buff.skill.deref(self).unwrap();
				let facts = self.gather_facts(skill);

				let recharge;
				match &skill.detail {
					defs::skill::Detail::Ability(ability) => {
						recharge = ability.recharge_time;
						let tier = ability.tier.first().unwrap();
						if let Some(_description) = &tier.description {
							description = _description.text_description.maybe_as_string(&self.db).or(description);
						}
					},
					defs::skill::Detail::Buff(buff) =>  {
						recharge = buff.recharge_time;
						let tier = buff.tier.first().unwrap();
						if let Some(description_full) = &tier.description_full {
							description = description_full.text_description.maybe_as_string(&self.db).or(description);
						}
						if let Some(_description_brief) = &tier.description_brief {
							name_brief = _description_brief.text_name.maybe_as_string(&self.db);
							description_brief = _description_brief.text_description.maybe_as_string(&self.db);
						}
					},
				}

				base_context = ContextGroup { recharge, facts: facts.base_facts};
				override_groups = facts.override_groups.into_iter().map(|g| ContextOverride { context: g.context, data: ContextGroup { recharge: 0, facts: g.data }}).collect();
				//Todo(Rennorb): recharge overrides

			},
			defs::r#trait::Detail::Display(_) => {
				//println!("display trait: {}", _trait.id);
			},
			defs::r#trait::Detail::Proficiency(proficiency) => {
				provides_weapon_access = proficiency.weapons.iter()
				.map(|access| crate::api::r#trait::WeaponAccess { //TODO(Rennorb) @cleanup: unify the structs?
					weapon: access.weapon,
					slot  : access.r#type,
				})
				.collect();
			},
		}

		Ok(api::r#trait::Trait {
			id: _trait.id,
			name: _trait.text_name.as_string(&self.db),
			name_brief,
			description,
			description_brief,
			icon: _trait.file_icon.maybe_as_string().unwrap_or_default(),
			slot: _trait.slot_type,
			overridable_information: base_context,
			override_groups,
			provides_weapon_access,
		})
	}
}