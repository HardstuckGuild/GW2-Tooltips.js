"use strict";
class GW2TooltipsV2 {
    static createCompleteContext(partialContext) {
        const stats = Object.assign({}, this.defaultContext.stats, partialContext.stats);
        return Object.assign({}, this.defaultContext, partialContext, { stats });
    }
    constructor() {
        this.cycling = false;
        this.context = [];
        this.inflators = (function () {
            const genericIconInflater = (clazz = '', icon) => (gw2Object, data) => {
                const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(icon || `https://assets.gw2dat.com/${data.icon}`, clazz, data.name));
                wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + data.name;
                wikiLink.target = '_blank';
                gw2Object.append(wikiLink);
            };
            return {
                skills: genericIconInflater('iconlarge'),
                traits: genericIconInflater(),
                items: genericIconInflater('', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFhSURBVGhD7ZoxkoIwFIYfexa0cDwBnkArT4ElNnuDPQC2dtvaqyeQE1gt3CWSEAOoszuzJoy/838N/CSZ4Zu8FxoipZS8KR/2+o7QDRO6YUI3TOiGCd0woRsmdMOEbpjQDRO6YUI3TOiGCd0eUG1mUTTbVDa+Iv727bh6NVfW5B+Y+lxsRYr1KNKsjnZEb+YV99DtsVnX0Ay66X4KQP2TMk9Ekry0UalD2s/NE0kP5r4/3Yy0g9fYy/b+CcK5mQmdF+zm25c3ubPYj1ywfqv2u0LS5dxGkXg8FTn/PKy10aT2no5jG5v8NGHPku3C9o9GN+SghHW7K6tT5vYmPMHcfivBgfDnpnuk2O2dzPwzT+pvQnvy1wf8sN92f25x9m1kdGsZoTg71Qde23Jfk3LQkhT+g4EJ3TChGyZ0w4RumNANE7phQjdM6IYJ3TChGyZ0w4RumNANE7phQjdM6IaIyAXGxL3ck02bowAAAABJRU5ErkJggg=='),
                specializations: function (gw2Object, data) {
                },
                pets: genericIconInflater('', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFqSURBVGhD7dkxcoJAFMbxtzmLpMjkBHgCrHIKLLXJPbAMR7BKI54gnCBV5C5kFxYEmdHMwCPzMd+vcUCc8e8+lkJTlqUs1JN/XSK2YWIbJrZhYhsmtmFiGya2YWIbJrZhmqjtvDV960Ph3/o/E65bmFxKL4vzfWC2Z//OHe5H0foddGYy+shikfTzD3GKtO634CUU+f5pF6Q7tH49i8PamE0q4ta4c346fopGcsvUmcn6hMTZ8OCS2OjrpYMPTkilrfr+7XF11GRavWPNtglnshktY4K92K/7tVu508XpmEv8FlXXOKvn1964qtHZJ5uuVrrx2Y67x+agtZfc6Ixk7TZeg37bbCM4MMO6Re9JaO/F6w5vnwft49o9K/LjSafcz8hID7e76jHg9S+sN1VnMLgj8f83TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDtNw2kV87CKi1eKVduQAAAABJRU5ErkJggg=='),
                "pvp/amulets": genericIconInflater('iconlarge', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAILSURBVGhD7Zo7csIwEEDlnMWmYDiBOQHQUHEEU0KTjpKOBsq4o6WiAZ8An4BJAb6LI602tvzBv2ESltnXoI/1efJKcoEVx7F4Uz7w9x1hN5qwG03YjSbsRhN2owm70YTdaMJuNGE3mrAbTdiNJuxGE3ajyYu4RbuhZQ13EWafQyO3YG4p5gHmidDELTj6wnVd4R//X04tc9P328BNqXmr/ew15NoQ13DfukJ4ZyORcvaEcLd3qNHoelUOyEp4UAGFZntsDWnoovA0go2MYTTZyRSpczOMCuMnE8BBkvmY+WQC2ZxEFZS7mY/mRjUb1VETk9HpEApvOlJpeyLDMjyccsEu5/AF9WI0VXOSI5v59nEc7dZyE5yxE3ux37rhctNhN1S7gZrbd3TO7g1EiVyK05drPOjZmNX5tpjLCcCw11v7+6HSTavNJr+ThRdRJfc0/DHcOpqxj6UtqXIDNREuHRwDR/kLOXNfApdFEg2NqXDTby23b9XW7iaXD9DodsVUls4hWOCxW7BZyrhf5dZLHyhdtja09Nf63pXfWI7svpTRpzo8nPQrSN7XyXWtVqjp2j50Uzd2ZksjMMVOtzieeBDhzvdKn+5l2IuLPOvTLbfu35OQNDup+wbk/87QhN1owm40YTeasBtN2I0m7EYTdqMJu9GE3WjCbjRhN5qwG03YjSbsRhN2o4gQPxqF5ksm6ZNyAAAAAElFTkSuQmCC'),
            };
        })();
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
        this.config = Object.assign({}, GW2TooltipsV2.defaultConfig, window.GW2TooltipsConfig);
        this.tooltip = TUtilsV2.newElm('div.tooltipWrapper');
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
        document.addEventListener('mousemove', event => {
            gw2tooltips.lastMouseX = event.pageX;
            gw2tooltips.lastMouseY = event.pageY;
            if (this.tooltip.style.display != 'none')
                gw2tooltips.positionTooltip();
        });
        document.addEventListener('contextmenu', event => {
            if (!this.cycleTooltipsHandler)
                return;
            event.preventDefault();
            this.cycleTooltipsHandler();
        });
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
            skills: new Map(),
            traits: new Map(),
            items: new Map(),
            specializations: new Map(),
            pets: new Map(),
            'pvp/amulets': new Map(),
        };
        for (const gw2Object of scope.getElementsByTagName('gw2object')) {
            const objId = +String(gw2Object.getAttribute('objId'));
            const type = (gw2Object.getAttribute('type') || 'skill') + 's';
            if (isNaN(objId) || !(type in objectsToGet))
                continue;
            const elementsWithThisId = objectsToGet[type].get(objId);
            if (elementsWithThisId)
                elementsWithThisId.push(gw2Object);
            else
                objectsToGet[type].set(objId, [gw2Object]);
            gw2Object.addEventListener('mouseenter', (e) => {
                const gw2Object = e.target;
                const type = (gw2Object.getAttribute('type') || 'skill') + 's';
                const objId = +String(gw2Object.getAttribute('objId'));
                if (type != 'skills' && type != 'traits')
                    return;
                const data = APICache.storage[type].get(objId);
                if (data) {
                    this.tooltip.replaceChildren(...this.generateToolTip(data, gw2Object));
                    this.tooltip.style.display = '';
                }
            });
            gw2Object.addEventListener('mouseleave', () => {
                this.tooltip.style.display = 'none';
                this.cycleTooltipsHandler = undefined;
            });
        }
        Object.entries(objectsToGet).forEach(async ([key, values]) => {
            if (values.size == 0)
                return;
            const inflator = this.inflators[key];
            const cache = APICache.storage[key];
            await APICache.ensureExistence(key, values.keys());
            for (const [id, objects] of values) {
                const data = cache.get(id);
                if (!objects || !data)
                    continue;
                for (const gw2Object of objects)
                    inflator(gw2Object, data);
            }
        });
    }
    getSlotName(skill) {
        let skillSlot;
        for (const palette of skill.palettes) {
            for (const slot of palette.slots) {
                switch (palette.type) {
                    case 'Equipment':
                        if (palette.weapon_type !== 'None') {
                            const replaceFn = (_, __, digit) => {
                                if (['Greatsword', 'Hammer', 'BowLong', 'Rifle', 'BowShort', 'Staff'].includes(palette.weapon_type) &&
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
                    default:
                        console.error(`unknown palette type '${palette.type}' for skill '${skill.name}'`);
                }
            }
        }
        return skillSlot;
    }
    processToolTipInfo(apiObject, context) {
        let recharge = '';
        const isSkill = 'recharge_override' in apiObject;
        if (isSkill) {
            if (context.gameMode !== 'Pve' && apiObject.recharge_override.length) {
                const override = apiObject.recharge_override.find(override => override.mode === context.gameMode && TUtilsV2.DurationToSeconds(override.recharge));
                if (override && override.mode === context.gameMode && TUtilsV2.DurationToSeconds(override.recharge)) {
                    recharge = TUtilsV2.newElm('ter', String(TUtilsV2.DurationToSeconds(override.recharge)), TUtilsV2.newImg('https://assets.gw2dat.com/156651.png', 'iconsmall'));
                }
            }
            else if (TUtilsV2.DurationToSeconds(apiObject.recharge)) {
                recharge = TUtilsV2.newElm('ter', String(TUtilsV2.DurationToSeconds(apiObject.recharge)), TUtilsV2.newImg('https://assets.gw2dat.com/156651.png', 'iconsmall'));
            }
        }
        const basic = TUtilsV2.newElm('tet', TUtilsV2.newElm('teb', apiObject.name), TUtilsV2.newElm('tes', `( ${isSkill ? this.getSlotName(apiObject) : apiObject.slot} )`), TUtilsV2.newElm('div.flexbox-fill'), recharge);
        const description = document.createElement('ted');
        if (apiObject.description)
            description.innerHTML = `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>`;
        const tooltip = TUtilsV2.newElm('div.tooltip', basic, description, ...SkillsProcessor.processFact(apiObject, APICache.storage['skills'], context));
        tooltip.dataset.id = String(apiObject.id);
        tooltip.style.marginTop = '5px';
        return tooltip;
    }
    generateToolTip(initialSkill, gw2Object) {
        const skillChain = [];
        const validTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard'];
        const addSkillToChain = (currentSkill) => {
            skillChain.push(currentSkill);
            if ('palettes' in currentSkill) {
                for (const palette of currentSkill.palettes) {
                    for (const slot of palette.slots) {
                        if (slot.next_chain && slot.profession !== 'None') {
                            const nextSkillInChain = APICache.storage['skills'].get(slot.next_chain);
                            if (nextSkillInChain) {
                                addSkillToChain(nextSkillInChain);
                            }
                        }
                    }
                }
                if (currentSkill.sub_skills) {
                    for (const subSkillId of currentSkill.sub_skills) {
                        const subSkillInChain = APICache.storage['skills'].get(subSkillId);
                        if (subSkillInChain && subSkillInChain.palettes.some(palette => validTypes.includes(palette.type))) {
                            addSkillToChain(subSkillInChain);
                        }
                    }
                }
            }
        };
        addSkillToChain(initialSkill);
        const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
        const chainTooltips = skillChain.map(skill => this.processToolTipInfo(skill, context));
        chainTooltips.forEach(tooltip => this.tooltip.append(tooltip));
        if (chainTooltips.length > 1) {
            gw2Object.classList.add('cycler');
            gw2Object.title = 'Right-click to cycle through tooltips';
            let currentTooltipIndex = 0;
            this.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex);
            this.cycleTooltipsHandler = () => {
                gw2tooltips.cycleTooltips();
                currentTooltipIndex = (currentTooltipIndex + 1) % chainTooltips.length;
                gw2tooltips.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex);
            };
        }
        return chainTooltips;
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
GW2TooltipsV2.defaultConfig = {
    autoInitialize: true,
};
const gw2tooltips = new GW2TooltipsV2();
if (gw2tooltips.config.autoInitialize)
    gw2tooltips.hookDocument(document);
