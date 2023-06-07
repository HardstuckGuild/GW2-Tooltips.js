"use strict";
class GW2TooltipsV2 {
    static createCompleteContext(partialContext) {
        const stats = Object.assign({}, this.defaultContext.stats, partialContext.stats);
        return Object.assign({}, this.defaultContext, partialContext, { stats });
    }
    constructor() {
        this.objectData = {
            skills: new Map(),
            items: new Map(),
            traits: new Map(),
            pets: new Map(),
            "pvp/amulets": new Map(),
            specializations: new Map(),
        };
        this.cycling = false;
        this.context = [];
        if (window.GW2TooltipsContext instanceof Array) {
            for (const partialContext of window.GW2TooltipsContext)
                this.context.push(GW2TooltipsV2.createCompleteContext(partialContext));
        }
        else if (window.GW2TooltipsContext) {
            this.context.push(GW2TooltipsV2.createCompleteContext(window.GW2TooltipsContext));
        }
        else {
            this.context.push(GW2TooltipsV2.createCompleteContext({}));
        }
        this.tooltip = TUtilsV2.newElement('div.tooltipWrapper');
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }
    async fetchAPIObjects(key, value) {
        let result = [];
        try {
            result = await HSAPI.getAPIObjects(key, value);
        }
        catch (error) {
            console.error(error);
        }
        return result;
    }
    displayCorrectChainTooltip(tooltips, tooltipIndex) {
        for (let index = 0; index < tooltips.length; index++) {
            tooltips[index].style.display = index === tooltipIndex ? '' : 'none';
        }
    }
    cycleTooltips() {
        if (!this.cycling)
            return;
        this.cycling = true;
        const chainTooltips = Array.from(this.tooltip.children);
        this.cyclePos = chainTooltips.length - this.baseTooltip;
        const totalTooltips = chainTooltips.length - this.baseTooltip;
        this.cyclePos = (this.cyclePos - 1 + totalTooltips) % totalTooltips;
        this.displayCorrectChainTooltip(chainTooltips, this.cyclePos);
        this.positionTooltip();
    }
    positionTooltip() {
        const tooltip = this.tooltip;
        const wpadminbar = document.getElementById('wpadminbar');
        const additionaloffset = wpadminbar ? wpadminbar.offsetHeight : 0;
        let tooltipXpos = this.lastMouseX + 16;
        if (this.lastMouseX + tooltip.offsetWidth + 22 > window.innerWidth) {
            tooltipXpos = window.innerWidth - 22 - tooltip.offsetWidth;
        }
        let tooltipYpos = this.lastMouseY - 6 - tooltip.offsetHeight;
        if (this.lastMouseY -
            tooltip.offsetHeight -
            13 -
            document.documentElement.scrollTop <
            0) {
            tooltipYpos = additionaloffset + 6 + document.documentElement.scrollTop;
        }
        tooltip.style.transform = `translate(${tooltipXpos}px, ${tooltipYpos}px)`;
    }
    hookDocument(scope, _unused) {
        const objectsToGet = {
            skills: [],
            traits: [],
            items: [],
            specializations: [],
            pets: [],
            'pvp/amulets': [],
        };
        let elementsNeedingWikiLinks = new Map();
        for (const gw2Object of scope.getElementsByTagName('gw2object')) {
            const objId = +String(gw2Object.getAttribute('objId'));
            const type = (gw2Object.getAttribute('type') || 'skill') + 's';
            if (isNaN(objId) || !(type in objectsToGet))
                continue;
            objectsToGet[type].push(objId);
            elementsNeedingWikiLinks.set(objId, gw2Object);
            gw2Object.addEventListener('mouseenter', (e) => {
                const element = e.target;
                const type = (element.getAttribute('type') || 'skill') + 's';
                const objId = +String(element.getAttribute('objId'));
                this.tooltip.replaceChildren();
                const data = this.objectData[type].get(objId);
                if (data) {
                    this.generateToolTip(data, element);
                    this.tooltip.style.display = '';
                }
            });
            gw2Object.addEventListener('mouseleave', () => {
                this.tooltip.style.display = 'none';
            });
        }
        Object.entries(objectsToGet).forEach(async ([key, values]) => {
            if (values.length == 0)
                return;
            const storage = this.objectData[key];
            for (const skill of await this.fetchAPIObjects(key, values))
                storage.set(skill.id, skill);
            for (const obj of storage.values()) {
                const gw2Object = elementsNeedingWikiLinks.get(obj.id);
                if (gw2Object) {
                    let wikiLink = document.createElement('a');
                    wikiLink.setAttribute('href', 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + obj.name);
                    wikiLink.setAttribute('target', '_blank');
                    wikiLink.innerHTML = TUtilsV2.newImg(`https://assets.gw2dat.com/${obj.icon}`, 'iconlarge', obj.name);
                    gw2Object.append(wikiLink);
                }
            }
        });
    }
    processSkillSlot(skill) {
        let skillSlot;
        skill.palettes.forEach((palette) => {
            for (const slot of palette.slots) {
                switch (palette.type) {
                    case 'Equipment':
                        if (palette.weapon_type !== 'None') {
                            const replaceFn = (_, __, digit) => {
                                if ([
                                    'Greatsword',
                                    'Hammer',
                                    'BowLong',
                                    'Rifle',
                                    'BowShort',
                                    'Staff',
                                ].includes(palette.weapon_type) &&
                                    ['Offhand1', 'Offhand2'].includes(slot.slot)) {
                                    digit = digit === '1' ? '4' : '5';
                                }
                                return `${palette.weapon_type} ${digit}`;
                            };
                            skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, replaceFn);
                        }
                        break;
                    case 'Standard':
                        if (slot.slot === 'Standard') {
                            skillSlot = 'Utility';
                        }
                        break;
                    case 'Heal':
                        skillSlot = 'Heal';
                        break;
                    case 'Bundle':
                        skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, (_, __, digit) => `Weapon ${digit}`);
                        break;
                    case 'Toolbelt':
                        skillSlot = 'Toolbelt';
                        break;
                    case 'Elite':
                        skillSlot = 'Elite';
                        break;
                    case 'Profession':
                        skillSlot = slot.slot;
                }
            }
        });
        return skillSlot;
    }
    processToolTipInfo(apiObject, context) {
        const basic = document.createElement('tet');
        const name = `<teb> ${apiObject.name} </teb>`;
        const slot = `<tes>( ${this.processSkillSlot(apiObject)} )</tes><div class="flexbox-fill"></div>`;
        let recharge;
        if (context.gameMode !== 'Pve' && apiObject.recharge_override.length) {
            apiObject.recharge_override.forEach((recharge_mode) => {
                if (recharge_mode.mode === context.gameMode) {
                    recharge = `${recharge_mode.recharge.secs
                        ? `<ter>
              ${recharge_mode.recharge.secs}
              ${TUtilsV2.newImg('https://assets.gw2dat.com/156651.png', 'iconsmall')}</ter>`
                        : ''} `;
                }
            });
        }
        else {
            recharge = `${apiObject.recharge.secs
                ? `<ter>
      ${apiObject.recharge.secs}
      ${TUtilsV2.newImg('https://assets.gw2dat.com/156651.png', 'iconsmall')}</ter>`
                : ''} `;
        }
        basic.innerHTML = `
     ${name}   
     ${slot}
     ${recharge}
`;
        const description = document.createElement('ted');
        description.innerHTML = apiObject.description ? `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>` : '';
        const tooltip = TUtilsV2.newElement('div.tooltip');
        tooltip.dataset.id = String(apiObject.id);
        tooltip.style.marginTop = '5px';
        tooltip.append(basic);
        tooltip.append(description);
        const factsElements = SkillsProcessor.processFact(apiObject, this.objectData['skills'], context);
        if (factsElements)
            tooltip.append(...factsElements);
        this.tooltip.append(tooltip);
        document.body.appendChild(this.tooltip);
    }
    generateToolTip(initialSkill, gw2Object) {
        const skillChain = [];
        const validTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard'];
        const addSkillToChain = (currentSkill) => {
            skillChain.push(currentSkill);
            currentSkill.palettes.forEach((palette) => {
                palette.slots.forEach((slot) => {
                    if (slot.next_chain && slot.profession !== 'None') {
                        const nextSkillInChain = this.objectData['skills'].get(slot.next_chain);
                        if (nextSkillInChain) {
                            addSkillToChain(nextSkillInChain);
                        }
                    }
                });
            });
            if (currentSkill.sub_skills) {
                currentSkill.sub_skills.forEach((subSkillId) => {
                    const subSkillInChain = this.objectData['skills'].get(subSkillId);
                    if (subSkillInChain && subSkillInChain.palettes.some(palette => validTypes.includes(palette.type))) {
                        addSkillToChain(subSkillInChain);
                    }
                });
            }
        };
        addSkillToChain(initialSkill);
        const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
        skillChain.forEach(skill => this.processToolTipInfo(skill, context));
        const chainTooltips = Array.from(this.tooltip.children);
        if (chainTooltips.length > 1) {
            gw2Object.classList.add('cycler');
            gw2Object.setAttribute('title', 'Right-click to cycle through tooltips');
            let currentTooltipIndex = 0;
            this.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex);
            gw2Object.addEventListener('contextmenu', event => {
                event.preventDefault();
                gw2tooltips.cycleTooltips();
                currentTooltipIndex = (currentTooltipIndex + 1) % chainTooltips.length;
                gw2tooltips.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex);
            });
        }
        gw2Object.addEventListener('mousemove', event => {
            gw2tooltips.lastMouseX = event.pageX;
            gw2tooltips.lastMouseY = event.pageY;
            gw2tooltips.positionTooltip();
        });
        return skillChain;
    }
}
GW2TooltipsV2.defaultContext = {
    traits: [],
    gameMode: 'Pve',
    stats: {
        level: 80,
        power: 1000,
        toughness: 1000,
        vitality: 1000,
        precision: 1000,
        ferocity: 1000,
        conditionDamage: 0,
        expertise: 0,
        concentration: 0,
        healing: 0,
        critDamage: 0,
    },
};
const gw2tooltips = new GW2TooltipsV2();
gw2tooltips.hookDocument(document);
