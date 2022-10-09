const gid = 212;
const user_1 = 27;
const user_2 = 28;
const user_3 = 29;
// const authorization =
// 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjcsImVtYWlsIjoidGVzdDFAdGVzdC5jb20iLCJuYW1lIjoiRXVsaSIsImNlbGxwaG9uZSI6IjA5MTIzNDU2NzgiLCJwaWN0dXJlIjpudWxsLCJwcm92aWRlciI6Im5hdGl2ZSIsImlhdCI6MTY2NTE1NzMxMCwiZXhwIjoxNjY1MjQzNzEwfQ.dDJRusWHp6EQEQaBJ-QiqSz5VOUzYiaylya7PGiaAVI';

const triangle_1 = {
    gid,
    body: `{"debt_main":{"gid":212,"date":"2022-10-08","title":"Euli pay","total":"150","lender":${user_1},"split_method":"1"},"debt_detail":[{"borrower":${user_1},"amount":50},{"borrower":${user_2},"amount":50},{"borrower":${user_3},"amount":50}]}`,
};
const triangle_2 = {
    gid,
    body: `{"debt_main":{"gid":212,"date":"2022-10-08","title":"Tim pay","total":"300","lender":${user_2},"split_method":"1"},"debt_detail":[{"borrower":${user_1},"amount":100},{"borrower":${user_2},"amount":100},{"borrower":${user_3},"amount":100}]}`,
};

module.exports = { triangle_1, triangle_2 };
