const DEBT_STATUS = { 0: 'deprach', 1: 'valid', 2: 'paid (for share book)', 3: 'to raven-split (for share book)', 4: 'customer deleted', 9: 'private' };
const SPLIT_METHOD = { 1: 'even', 2: 'customize', 3: 'by share', 4: 'by percentage', 5: 'full_amount' };
const USER_ROLE = { 4: 'owner', 3: 'administer', 2: 'editor', 1: 'viewer' };
const ROLE_PERMISSION = { 4: 6, 3: 5, 2: 4, 1: 1 }; //group-debt R-CU-D ex. 4 = (1+1+1)+(1+1+1)
const GROUP_TYPE = { 1: 'group', 2: 'pair', 3: 'group_buying' };
