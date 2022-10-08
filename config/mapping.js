const DEBT_STATUS = { deprach: 0, valid: 1, paid: 2, transfer_to_raven_split: 3, customer_deleted: 4, settle: 5, private: 9 };
const SPLIT_METHOD = { even: 1, customize: 2, by_share: 3, by_percentage: 4, full_amount: 5 };
const USER_ROLE = { owner: 4, administer: 3, editor: 2, viewer: 1 };
const GROUP_TYPE = { group: 1, pair: 2, group_buying: 3 };
const BESTGRAPH_STATUS = {
    processing: -1,
    finishedProcessing: 0,
    needProcess: 5,
};

module.exports = { DEBT_STATUS, SPLIT_METHOD, USER_ROLE, GROUP_TYPE, BESTGRAPH_STATUS };
