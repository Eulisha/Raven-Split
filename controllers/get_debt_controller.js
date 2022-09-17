const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const Admin = require('../models/admin_model');
const pageSize = process.env.PAGE_SIZE;
const Mapping = require('../config/mapping');

const getDebts = async (req, res) => {
    console.log('@getDebts control:', req.params);
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }

    const gid = Number(req.params.id);
    const uid = req.user.id;
    const paging = Number(req.query.paging) || 0;
    const debtMainRecords = [];
    //撈所有該群組內的帳
    try {
        const [debtMainResult] = await Debt.getDebts(gid, pageSize, paging);
        if (!debtMainResult) {
            res.status(500).json({ err: 'Internal Server Error' });
        }
        console.log('debtMain:', debtMainResult);
        //查借貸明細
        for (let debtMain of debtMainResult) {
            let debtMainId = debtMain.id;
            let ownAmount;
            let isOwned = false;
            let [debtDetailResult] = await Debt.getDebtDetail(debtMainId, uid);
            console.log('debtDetail:', debtDetailResult);

            //自己沒有參與這筆帳
            if (!debtDetailResult) {
                debtDetailResult = {};
                debtDetailResult.amount = 0;
            }
            //自己是付錢的人
            if (uid === debtMain.lender) {
                isOwned = true;
                ownAmount = debtMain.total - debtDetailResult.amount;
            } else {
                ownAmount = debtDetailResult.amount;
            }

            const debtMainRecord = {
                id: debtMain.id,
                gid,
                date: debtMain.date,
                title: debtMain.title,
                total: debtMain.total,
                isOwned,
                lender: debtMain.lender,
                split_method: debtMain.split_method,
                ownAmount,
            };
            debtMainRecords.push(debtMainRecord);
        }
        res.status(200).json({ data: debtMainRecords });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getDebtDetail = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    try {
        const debtMainId = req.params.debtId;
        const result = await Debt.getDebtDetail(debtMainId);
        res.status(200).json({ data: result });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getMeberBalances = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    try {
        const gid = Number(req.params.id);
        const result = await Debt.getAllBalances(gid);
        return res.status(200).json({ data: result });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getSettle = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const uid = req.user.id;
    try {
        const resultGetGraph = await Graph.getGraph(gid);
        console.warn(resultGetGraph);
        if (!resultGetGraph) {
            throw new Error('Internal Server Error');
        }
        if (!resultGetGraph === 0) {
            return res.status(400).json({ err: 'no matched result' }); //FIXME:status code & err msg fine-tune
        }
        const graph = resultGetGraph.records.map((record) => {
            let amount = record.get('amount').toNumber();
            let borrower = record.get('borrower').toNumber();
            let lender = record.get('lender').toNumber();
            return { borrower, lender, amount };
        });
        const resultSetSetting = await Admin.setSettling(gid, uid);
        if (!resultSetSetting) {
            throw new Error('Internal Server Error');
        }
        console.error(graph);
        await res.status(200).json({ data: graph });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getUserBalances = async (req, res) => {
    const uid = req.params.uid;
    try {
        const result = await Debt.getUserBalances(uid);
        const borrow = {};
        const lend = {};
        console.debug('getUserBalances result: ', result);

        //borrow: 我跟lender借錢
        if (result[0].length === 0) {
            borrow = null;
        } else {
            result[0].map((debt) => {
                console.debug('debt borrow: ', debt);
                if (!borrow[debt.lender]) {
                    borrow[debt.lender] = { uid: debt.lender, pair: null, total: null, group_normal: [], group_buying: [] };
                }
                if (Number(debt.type) === Mapping.GROUP_TYPE.pair) {
                    //兩人分帳
                    borrow[debt.lender]['uid'] = debt.lender;
                    borrow[debt.lender]['pair'] = debt.amount;
                    borrow[debt.lender]['total'] += debt.amount;
                } else {
                    borrow[debt.lender]['total'] += debt.amount;
                    group = { gid: debt.gid, group_name: debt.name, amount: debt.amount };
                    if (Number(debt.type) === Mapping.GROUP_TYPE.group) {
                        //一般分帳群
                        borrow[debt.lender]['group_normal'].push(group);
                    } else {
                        //團購分帳群
                        borrow[debt.lender]['group_buying'].push(group);
                    }
                }
                console.debug(debt, borrow);
            });
        }

        //lend: 我借borrower錢
        if (result[1].length === 0) {
            borrow = null;
        } else {
            result[1].map((debt) => {
                console.debug('debt lend: ', debt);
                if (!lend[debt.borrower]) {
                    lend[debt.borrower] = { uid: debt.borrower, pair: null, total: null, group_normal: [], group_buying: [] };
                }
                if (Number(debt.type) === Mapping.GROUP_TYPE.pair) {
                    //兩人分帳
                    lend[debt.borrower]['uid'] = debt.borrower;
                    lend[debt.borrower]['pair'] = debt.amount;
                    lend[debt.borrower]['total'] += debt.amount;
                } else {
                    lend[debt.borrower]['total'] += debt.amount;
                    group = { gid: debt.gid, group_name: debt.name, amount: debt.amount };
                    if (Number(debt.type) === Mapping.GROUP_TYPE.group) {
                        //一般分帳群
                        lend[debt.borrower]['group_normal'].push(group);
                    } else {
                        //團購分帳群
                        lend[debt.borrower]['group_buying'].push(group);
                    }
                }
                console.debug(debt, lend);
            });
        }
        const data = { borrow: Object.values(borrow), lend: Object.values(lend) };
        res.status(200).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ err: 'Internal Server Error.' });
    }
};

module.exports = { getDebts, getDebtDetail, getDebtDetail, getMeberBalances, getSettle, getUserBalances };

// let borrow = { uid1: { uid: null, total: null, pair: null, group_noraml: [], group_buying: [] },
//                  uid2: { uid: null, total: null, pair: null, group_noraml: [], group_buying: [] }
//                 };

//     constdebt = {
//         borrow: [
//             {
//                 uid: 1,
//                 total: 1000,
//                 pair: 500,
//                 groups: [
//                     { gid: 10, group_name: 'A', amount: 300 },
//                     { gid: 15, group_name: 'B', amount: 200 },
//                 ],
//             },
//         ],
//         lend: [
//             {
//                 uid: 2,
//                 total: 500,
//                 pair: 100,
//                 groups: [
//                     { gid: 20, group_name: 'C', amount: 200 },
//                     { gid: 25, group_name: 'B', amount: 200 },
//                 ],
//             },
//         ],
//     };
// }
