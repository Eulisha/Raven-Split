//create
const createDebtTest = async (gid, authorization, body) => {
    try {
        const res = await fetch(`https://raven-split.life/api/debt/debt/${gid}`, {
            headers: {
                accept: 'application/json, text/plain, */*',
                authorization: `Bearer ${authorization}`,
                'content-type': 'application/json',
            },
            body,
            method: 'POST',
        });
        return res;
    } catch (err) {
        throw new Error({ err });
    }
    // const expect = { data: { debtId: 1299, detailIds: [ 2721, 2722, 2723 ] } };
};

//update
const updateDebtTest = async (gid, authorization, body, debtId) => {
    try {
        const res = await fetch(`https://raven-split.life/api/debt/debt/${gid}/${debtId}`, {
            headers: {
                accept: 'application/json, text/plain, */*',
                authorization: `Bearer ${authorization}`,
                'content-type': 'application/json',
            },
            body,
            method: 'PUT',
        });
        // { data: { debtId: 1300, detailIds: [ 2724, 2725, 2726 ] } }
        return res;
    } catch (err) {
        throw new Error({ err });
    }
};

//delete
const deleteDebtTest = async (gid, authorization, debtId) => {
    try {
        const res = await fetch(`https://raven-split.life/api/debt/debt/${gid}/${debtId}`, {
            headers: {
                accept: 'application/json, text/plain, */*',
                authorization: `Bearer ${authorization}`,
            },
            body: null,
            method: 'DELETE',
        });

        // { data: { debtId: 1300 } }
        return res;
    } catch (err) {
        throw new Error({ err });
    }
};

//settle pair
const settlePairTest = async (gid, authorization, user1, user2) => {
    try {
        const res = await fetch(`https://raven-split.life/api/debt/settle-pair/${gid}/${user1}/${user2}`, {
            headers: {
                accept: 'application/json, text/plain, */*',
                authorization: `Bearer ${authorization}`,
                'content-type': 'application/json',
            },
            body: '{"settle_main":{"gid":212,"date":"2022-10-08"}}',
            method: 'POST',
        });
        return await res.json();
        // { err: 'Balances not exist.' }
    } catch (err) {
        return err;
    }
};

//settle all
const settleAllTest = async (gid, authorization) => {
    try {
        const res = await fetch(`https://raven-split.life/api/debt/settle/${gid}`, {
            headers: {
                accept: 'application/json, text/plain, */*',
                authorization: `Bearer ${authorization}`,
                'content-type': 'application/json',
            },
            body: '{"settle_main":{"gid":212,"date":"2022-10-08"},"settle_detail":[{"borrower":27,"lender":29,"amount":300}]}',
            method: 'POST',
        });
        return await res.json();
        //{ data: { debtId: 1299, detailIds: [ 2721, 2722, 2723 ] } }
    } catch (err) {
        return err;
    }
};

module.exports = { createDebtTest, updateDebtTest, deleteDebtTest, settlePairTest, settleAllTest };
