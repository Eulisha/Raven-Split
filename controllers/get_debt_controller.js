require('dotenv').config();
const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const Admin = require('../models/admin_model');
const pageSize = process.env.PAGE_SIZE;
const Mapping = require('../config/mapping');

const getDebts = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }

    const gid = Number(req.params.id);
    const uid = req.user.id;
    const paging = Number(req.query.paging) - 1 || 0;
    console.info('controller: gid, uid, paging: ', gid, uid, paging, req.id);

    const debtMainRecords = [];
    //撈所有該群組內的帳
    try {
        const [debtMainResult] = await Debt.getDebts(gid, pageSize, paging);
        if (!debtMainResult) {
            console.error(debtMainResult);
            return res.status(500).json({ err: 'Internal Server Error' });
        }
        console.log('debtMain:', debtMainResult);
        //查借貸明細
        for (let debtMain of debtMainResult) {
            let debtMainId = debtMain.id;
            let ownAmount = 0;
            let isOwned = false;
            let [debtDetailResult] = await Debt.getDebtDetail(debtMainId, uid);
            console.log('debtDetail:', debtDetailResult);

            //自己沒有參與這筆帳
            if (!debtDetailResult) {
                isOwned = null;
                debtDetailResult = {};
                debtDetailResult.amount = 0;
            }
            //自己是付錢的人
            if (uid == debtMain.lender) {
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

        return res.status(200).json({ data: debtMainRecords });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
const getDebtDetail = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const debtMainId = req.params.debtId;
    console.info('controller: debtMainId: ', debtMainId, req.id);
    try {
        const result = await Debt.getDebtDetail(debtMainId);
        if (!result) {
            console.error(result);
            throw new Error('Internal Server Error');
        }
        return res.status(200).json({ data: result });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
const getDebtPages = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    console.info('controller: gid:', gid, req.id);

    try {
        //查paging
        const count = await Debt.getDebtCount(gid);
        if (!count) {
            console.error(count);
            return res.status(500).json({ err: 'Internal Server Error' });
        }
        const pageCount = Math.ceil(count[0].count / Number(pageSize));
        console.info('controller count, pageCount: ', count, count.count, pageSize, pageCount);
        return res.status(200).json({ data: { pageCount } });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};

const getMeberBalances = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    console.info('controller: gid: ', gid, req.id);
    const conn = await pool.getConnection(); //配合其他route要使用get connection

    try {
        const groupUserIds = await Admin.getGroupUserIds(gid);
        if (!groupUserIds) {
            console.log(groupUserIds);
            throw new Error('Internal Server Error');
        }

        const balances = await Debt.getAllBalances(conn, gid); //{id, borrower, lender, amount}
        if (!balances) {
            console.log(balances);
            throw new Error('Internal Server Error');
        }

        let balancesGroupByUser = {}; //{uid:{uid:null, balance:null, detail:{borrower:null, lender:null, amount:null}}}
        //把所有成員各自的object建好
        for (let user of groupUserIds) {
            balancesGroupByUser[user.uid] = { uid: user.uid, balance: 0, detail: [] };
        }
        console.debug('initial object: ', balancesGroupByUser);
        //group by uid
        for (let balance of balances) {
            //存borrower的
            balancesGroupByUser[balance.borrower]['balance'] -= balance.amount;
            balancesGroupByUser[balance.borrower]['detail'].push(balance);
            //存lender的
            balancesGroupByUser[balance.lender]['balance'] += balance.amount;
            balancesGroupByUser[balance.lender]['detail'].push(balance);
        }
        balancesGroupByUser = Object.values(balancesGroupByUser);
        console.info('balancesGroupByUser: ', balancesGroupByUser);
        return res.status(200).json({ data: balancesGroupByUser });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
    }
};
const getSettle = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const uid = req.user.id;
    console.info('controller: gid, uid:', gid, uid, req.id);

    const conn = await pool.getConnection(); //配合其他route要使用get connection

    //check if graph is newest
    const currNewDataAmount = await Admin.getNewDataAmount(conn, gid);
    console.log('currNewDataAmount: ', currNewDataAmount);

    let processStatus = currNewDataAmount[0].hasNewData;

    //not updated yet
    if (processStatus !== 0) {
        await produceSqsJob(gid, process.env.PRIORITY_SQS_URL);
        console.log('sqs msg created');
    }

    //wait for calculate finished
    if (processStatus === -1 || processStatus !== 0) {
        for (let count = 0; count < 10; count++) {
            setTimeout(async (gid) => {
                currNewDataAmount = await Admin.getNewDataAmount(conn, gid);
                console.log('currNewDataAmount: ', currNewDataAmount);
                processStatus = currNewDataAmount[0].hasNewData;
            }, 500);
            if (processStatus === 0) break;
        }
    }
    conn.release();

    //still not finished after 5s, ask user come back later
    if (processStatus !== 0) {
        console.error('waiting for sqs resource', processStatus);
        return res.status(503).json({ err: 'waiting for sqs resource' });
    }

    const session = driver.session();
    await session.readTransaction(async (txc) => {
        try {
            const resultGetGraph = await Graph.getGraph(txc, neo4j.int(gid));
            if (!resultGetGraph) {
                console.error('getGraph fail get false:', resultGetGraph);
                throw new Error('Internal Server Error');
            }
            if (!resultGetGraph.length == 0) {
                console.error('getGraph fail get no match:', resultGetGraph);
                // session.close();
                return res.status(404).json({ err: 'No matched result' });
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
            console.debug('controller getSettle graph: ', graph);

            // session.close();
            return res.status(200).json({ data: graph });
        } catch (err) {
            console.error(err);
            // session.close();
            return res.status(500).json({ err: 'Internal Server Error' });
        }
    });
};
const getUserBalances = async (req, res) => {
    const uid = req.user.id;
    console.info('uid: ', uid, req.id);
    try {
        const result = await Debt.getUserBalances(uid); //同時撈borrow跟lend
        if (!result) {
            console.error(result);
            throw new Error('Internal Server Error');
        }
        let borrow = {};
        let lend = {};
        let data = {};
        let summary = { borrow: 0, lend: 0, net: 0 };
        console.debug('getUserBalances result: ', result);

        //borrow: 我跟lender借錢
        if (result[0].length == 0) {
            data.borrow = [];
        } else {
            result[0].map((debt) => {
                console.debug('debt borrow: ', debt);
                summary.borrow += debt.amount;
                if (!borrow[debt.lender]) {
                    borrow[debt.lender] = { uid: debt.lender, user_name: debt.user_name, pair: null, total: null, group_normal: [], group_buying: [] };
                }
                if (Number(debt.type) == Mapping.GROUP_TYPE.pair) {
                    //兩人分帳
                    borrow[debt.lender]['uid'] = debt.lender;
                    borrow[debt.lender]['pair'] = debt.amount;
                    borrow[debt.lender]['total'] += debt.amount;
                } else {
                    borrow[debt.lender]['total'] += debt.amount;
                    group = { gid: debt.gid, group_name: debt.group_name, amount: debt.amount };
                    if (Number(debt.type) == Mapping.GROUP_TYPE.group) {
                        //一般分帳群
                        borrow[debt.lender]['group_normal'].push(group);
                    } else {
                        //團購分帳群
                        borrow[debt.lender]['group_buying'].push(group);
                    }
                }
                console.debug(debt, borrow);
                data.borrow = Object.values(borrow);
            });
        }

        //lend: 我借borrower錢
        if (result[1].length == 0) {
            data.lend = [];
        } else {
            result[1].map((debt) => {
                console.debug('debt lend: ', debt);
                summary.lend += debt.amount;
                if (!lend[debt.borrower]) {
                    lend[debt.borrower] = { uid: debt.borrower, user_name: debt.user_name, pair: null, total: null, group_normal: [], group_buying: [] };
                }
                if (Number(debt.type) == Mapping.GROUP_TYPE.pair) {
                    //兩人分帳
                    lend[debt.borrower]['uid'] = debt.borrower;
                    lend[debt.borrower]['pair'] = debt.amount;
                    lend[debt.borrower]['total'] += debt.amount;
                } else {
                    lend[debt.borrower]['total'] += debt.amount;
                    group = { gid: debt.gid, group_name: debt.group_name, amount: debt.amount };
                    if (Number(debt.type) == Mapping.GROUP_TYPE.group) {
                        //一般分帳群
                        lend[debt.borrower]['group_normal'].push(group);
                    } else {
                        //團購分帳群
                        lend[debt.borrower]['group_buying'].push(group);
                    }
                }
                console.debug(debt, lend);
                data.lend = Object.values(lend);
            });
        }
        summary.net = summary.lend - summary.borrow;
        data.summary = summary;
        return res.status(200).json({ data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ err: 'Internal Server Error.' });
    }
};

module.exports = { getDebts, getDebtDetail, getDebtDetail, getDebtPages, getMeberBalances, getSettle, getUserBalances };
