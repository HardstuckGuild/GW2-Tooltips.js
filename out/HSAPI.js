"use strict";
class FakeAPI {
    bulkRequest(endpoint, ids) {
        return new Promise((resolve, reject) => {
            const allSkills = window['DUMP_output_' + endpoint];
            if (!allSkills)
                reject(`'${endpoint}' doesn't exist in mock data`);
            else
                resolve(allSkills.filter(data => Array.prototype.includes.call(ids, data.id)));
        });
    }
}
class HSAPI {
    bulkRequest(endpoint, ids) {
        throw new Error("Method not implemented.");
    }
}
