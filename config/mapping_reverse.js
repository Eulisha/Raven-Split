const DEBT_STATUS = { 0: 'deprach', 1: 'valid', 2: 'paid (for share book)', 3: 'to raven-split (for share book)', 4: 'customer deleted', 9: 'private' };
const SPLIT_METHOD = { 1: 'even', 2: 'customize', 3: 'by share', 4: 'by percentage' };
const USER_ROLE = { 4: 'owner', 3: 'administer', 2: 'editor', 1: 'viewer' };

module.exports = { DEBT_STATUS, SPLIT_METHOD, USER_ROLE };
