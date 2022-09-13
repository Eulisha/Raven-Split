const DEBT_STATUS = { deprach: 0, valid: 1, paid: 2, transfer_to_raven_split: 3, customer_deleted: 4, private: 9 };
const SPLIT_METHOD = { even: 1, customize: 2, by_share: 3, by_percentage: 4, full_amount: 5 };

module.exports = { DEBT_STATUS, SPLIT_METHOD };