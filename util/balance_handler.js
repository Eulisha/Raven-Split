const Debt = require('../models/debt_model');
const pool = require('../config/mysql');

const updateBalance = async (conn, gid, debtMain, debtDetail) => {
    try {
        // 拉出pair本來的借貸並更新
        for (let debt of debtDetail) {
            //剔除自己的帳
            if (debt.borrower == debtMain.lender) {
                continue;
            }
            // 剔除金額是0的帳
            if (debt.amount === 0) {
                continue;
            }
            //查正向 borrower-own->lender
            const getBalanceResult = await Debt.getBalance(conn, gid, debt.borrower, debtMain.lender);
            if (!getBalanceResult) {
                console.error('@updateBalance handler: db getBalance fail: ', req.path, result);
                throw new Error('Internal Server Error');
            }
            if (getBalanceResult.length !== 0) {
                // 原本債務關係和目前一樣 borrower-own->lender
                let balanceId = getBalanceResult[0].id;
                let originalDebt = getBalanceResult[0].amount;
                let newBalance = originalDebt + debt.amount; //add more debt
                if (newBalance > 0) {
                    //  維持 borrower-own->lender
                    const result = await Debt.updateBalance(conn, balanceId, debt.borrower, debtMain.lender, newBalance);
                    if (!result) {
                        console.error('@updateBalance handler: db updateBalance fail:', req.path, result);
                        throw new Error('Internal Server Error');
                    }
                } else if (newBalance < 0) {
                    // 改為 borrower <-own-lender
                    //如果是update debt，會把舊的帳的值先變成負的，再呼叫這個function做計算，所以確實有可能是負的
                    const result = await Debt.updateBalance(conn, balanceId, debtMain.lender, debt.borrower, -newBalance);
                    if (!result) {
                        console.error('@updateBalance handler: db updateBalance fail: ', req.path, result);
                        throw new Error('Internal Server Error');
                    }
                } else if (newBalance === 0) {
                    //帳結清了，刪除balance
                    const result = await Debt.deleteDebtBalance(conn, balanceId);
                    if (!result) {
                        console.error('@updateBalance handler: db deleteDebtBalance fail : ', req.path, result);
                        throw new Error('Internal Server Error');
                    }
                }
            } else {
                // 查反向 borrower <-own-lender
                const getBalanceResult = await Debt.getBalance(conn, gid, debtMain.lender, debt.borrower);
                if (!getBalanceResult) {
                    console.error('@updateBalance handler: db getBalance fail: ', req.path, result);
                    throw new Error('Internal Server Error');
                }
                if (getBalanceResult.length !== 0) {
                    // 原本債務關係和目前相反 borrower <-own-lender
                    let balanceId = getBalanceResult[0].id;
                    let originalDebt = getBalanceResult[0].amount;
                    let newBalance = originalDebt - debt.amount; //pay back
                    if (newBalance > 0) {
                        //  維持 borrower <-own-lender
                        const result = await Debt.updateBalance(conn, balanceId, debtMain.lender, debt.borrower, newBalance);
                        if (!result) {
                            console.error('@updateBalance handler: db updateBalance fail: ', req.path, result);
                            throw new Error('Internal Server Error');
                        }
                    } else if (newBalance < 0) {
                        // 改為 borrower-own->lender
                        const result = await Debt.updateBalance(conn, balanceId, debt.borrower, debtMain.lender, -newBalance);
                        if (!result) {
                            console.error('@updateBalance handler: db updateBalance fail: ', req.path, result);
                            throw new Error('Internal Server Error');
                        }
                    } else if (newBalance === 0) {
                        //帳結清了，刪除balance
                        const result = await Debt.deleteDebtBalance(conn, balanceId);
                        if (!result) {
                            console.error('@updateBalance handler: db deleteDebtBalance fail : ', req.path, result);
                            throw new Error('Internal Server Error');
                        }
                    }
                } else {
                    //都沒查到，新增一筆
                    if (debt.amount > 0) {
                        const result = await Debt.createBalance(conn, gid, debt.borrower, debtMain.lender, debt.amount);
                        if (!result) {
                            console.error('@updateBalance handler: db createBalance fail : ', result);
                            throw new Error('Internal Server Error');
                        }
                    } else {
                        const result = await Debt.createBalance(conn, gid, debtMain.lender, debt.borrower, -debt.amount);
                        if (!result) {
                            console.error('@updateBalance handler: db createBalance fail : ', req.path, result);
                            throw new Error('Internal Server Error');
                        }
                    }
                }
            }
        }
        return true;
    } catch (err) {
        console.error('@updateBalance handler: err:', req.path, err);
    }
};
const createBatchBalance = async (req, res) => {
    //批次建立建立member balance, 暫時沒用到
    //整理members的排列組合
    let memberCombo = [];
    for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length - 1; j++) {
            let x = i + j + 1;
            if (x > members.length - 1) {
                break;
            }
            memberCombo.push([members[i], members[x]]);
        }
    }
    const balanceResult = await Admin.createBatchBalance(groupId, memberCombo, conn);
    if (!balanceResult) {
        console.error('@createBatchBalance handler: db createBatchBalance fail:', req.path, balanceResult);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
module.exports = { createBatchBalance, updateBalance };
