
# Raven Split

Raven Split is a website dedicated to solving the daily troubles of split expenses within a group. We developed an algorithm to help simplify payback relationship.

## Table of Content

- [Table of Content](#Table-of-Content)
- [Intro](#Intro)
- [Features](#Features)
- [Tech](#Tech)
    - [Architecture](#Architecture)
    - [Glossary](#Glossary)
    - [Algorithm explanation](#Algorithm-explanation)
    - [Stragety](#Stragety)
    - [Tech Stack](#Tech-Stack)
    



## Intro 

Having trouble with calculating shared expenses with friends after dining together? 
Tiered of taking out wallet or opening LINE Pay ever time after joining an order at UBER EAT with colleagues?
Don’t worry! With raven split service, you can release yourself from those bothering mathematic trivialities!

### Get start right now!

You can use the below account for testing.
|Account|Password|
|----------------------|--------|
|guest@raven-split.life|12345678|

If you want to create a group by yourself, you can add the following accounts.
|Account|
|-----------------------|
|guest2@raven-split.life|
|guest3@raven-split.life|
|guest4@raven-split.life|
|guest5@raven-split.life|

## Features
- Track balance: Track self balances accross groups on dashboard clearly.

- Organize expense: Split expenses easily with friends, colleages, family, or anyone.

- Add expenses: Record shared expense quickly with split/customized mode and calculate helper.
<div><img alt="add_expense" src="https://user-images.githubusercontent.com/62165222/195963851-02adac2a-8afc-49f8-8316-e30875a2828b.gif" width="50%"/><img alt="edit_expense" src="https://user-images.githubusercontent.com/62165222/195963866-e7c2fd6a-27cd-4fe2-8556-7ed2d38adea5.gif" width="50%"/><img alt="delete_expense" src="https://user-images.githubusercontent.com/62165222/195963869-0d94be2c-0672-4651-b63b-1c05ced98f54.gif" width="50%"/></div>

- Pay friends back: Settle up with a friend and record the payment.

- Simplify payback relations: Settle up in group wisely with raven split algorithm suggestion.




## Tech
### Overall Architecture:
![Structure](https://user-images.githubusercontent.com/62165222/195860285-e50392b7-4fe9-4d41-92a2-cb01f2ddc0f2.png)

### Glossary:
The different between _*Raw Data*_, _*Balance*_, _*Best Settle Solution*_
- Raw Data: the expense data come from client input, including who paid and who were involved in this expense.
- Balance:  the current owe amount and owe relationship between two people, which is calculated by all the previous expense records.
- Best Settle Solution: the simplified payback solution which took all the balances in the group, and then use the algorithm to reduct the total number of repayments between group members.

### Algorithm explanation:

- Algorithm Steps:

 1. Pick up two noeds(people) as start and end in the graph. 
 2. Pick up one path that can go from start to end, which might pass through couples of nodes (other people).
 3. Find the bottlenect capacity(minimum debt amount on this path).
 4. For each eage, minus bottlenect capacity to get residual(remaining debts).
 5. Add this capacity to shortest path(edge of start to end).

  _Note: In this algorithm we will not build a new payback relatoin if there is no current debt replation between two people. (In the real world cases, it is possibly that the two people are not knowing each other but only joining the same group.)_

- Real Examples:
<img alt="Three_people_best_settle_solution" src="https://user-images.githubusercontent.com/62165222/195865569-0b35eac4-a390-4241-81f1-ab9950b0680d.gif" width="50%"/>

 1. Origin: Adam owes Euli $100, Adam owes Tim $50, Tim owes Euli $50.
 2. Adam owes Tim $50, Tim owes Euli $50 => Turns to Adam pays Euli $50
 3. Adam owes Euli $100 + $50 = $150.

- A glance of a complex example in ten people group
<div align="center"><img alt="Ten_people_best_settle_solution" src="https://user-images.githubusercontent.com/62165222/195868659-2ea111ef-6848-4a19-ac78-4f704ce55cc2.gif" width="50%"/></div>
1. Having 30 debts between group members
2. Reduced to 9 debts after calculating by raven split algorithum

### Stragety:
1. Applied both relational database and graph database
RDS MySQl is used for saving raw data and balances. In the other hand, Neo4j is used to save best settle solutions. 
With this structure, we can guarantee the consistency of user data with the trait of relational database, and also take adventage of relation base structure of graph database to fasten algorithm calculation.

2. Implement Lambda and SQS to handle best settle calcultion when needed
Considering the resouce consuing by best settle calulation and complexity of calculation itself influenced by the amount of edges(payment relationships), it is not good either to conduct calculation per modification nor waiting until user request.
Hence, implement the following design for improvement:
  - Couting the amount of expense modification, conduct best settle calculation once per 5 modification.
  - Implement AWS Lambda for best settle calculation to ease the system loading. Produce job to AWS SQS to trigger Lambda when needed.
  - Seperate prioritized queue to deal with immidiate best settle solution checking request from user.


## Tech Stack

**Server:** Node, Express

**Database:** RDS MySQL, Neo4j

**AWS Serverless Service:** Lambda, SQS

**Client:** React, Bootstrap, Material-UI


