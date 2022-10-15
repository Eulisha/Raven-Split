
# Raven Split

Raven Split is a website dedicated to solving the daily troubles of split expenses within a group. We developed an algorithm to help simplify the payback relationship.

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
    - [Demo](#Demo)
    
## Intro 

Having trouble with calculating shared expenses with friends after dining together? 
Tired of taking out wallet or opening LINE Pay ever time after joining an order at UBER EAT with colleagues?
Don’t worry! With Raven Split service, you can release yourself from those bothering mathematic trivialities!

### Get started right now: [Raven Split](https://raven-split.life/)

You can use the below account to explore Raven Split.
|Account|Password|
|----------------------|--------|
|guest@raven-split.life|12345678|

If you want to create a group by yourself, you can use the following accounts.
|Account|
|-----------------------|
|guest2@raven-split.life|
|guest3@raven-split.life|
|guest4@raven-split.life|
|guest5@raven-split.life|

## Features
- Track balance: Track self-balances as well as debt details across groups on the dashboard clearly.
- Organize expenses: Split expenses easily with friends, colleagues, family, or anyone.
- Add expenses: Record shared expenses quickly with split/customized mode and calculate helper.
- Pay friends back: Settle up with a friend and record the payment anytime.
- Simplify payback relations: Settle up with the whole group by simplized way calculating by Raven Split algorithm.

## Techniques
### Overall Architecture:
![Structure](https://user-images.githubusercontent.com/62165222/195860285-e50392b7-4fe9-4d41-92a2-cb01f2ddc0f2.png)

### Glossary:
- Raw Data: the expense data come from client input, including who paid and who were involved in this expense.
- Balance:  the current owe amount and owe relationship between two people, which is calculated by all the previous expense records.
- Best Settle Solution: the simplier payback solution which took all the balances in the group, and then use the algorithm to reduct the total number of repayments between group members, but still keep everyone get there full owed amount back.

### Algorithm explanation:

- #### Mechanism:
```
    1. Pick up two nodes (people) as start and end in the graph. 
    2. Pick up one path that can go from start to end, which might pass through couple of nodes (other people).
    3. Find the bottleneck capacity (minimum debt amount on this path).
    4. For each edge, minus bottleneck capacity to get residual (remaining debts).
    5. Add this capacity to the shortest path (edge of start to end).
```

  _Note: In this algorithm, we will not build a new payback relation if there is no current debt relation between the two people. (In real world cases, it is probably that the two people are not knowing each other but just join the same group.)_

- #### A simple example of three members' group:
<div align="center"><img alt="Three_people_best_settle_solution" src="https://user-images.githubusercontent.com/62165222/195865569-0b35eac4-a390-4241-81f1-ab9950b0680d.gif" width="50%"/></div>


    1. Origin debt: Adam owes Euli $100, Adam owes Tim $50, and Tim owes Euli $50.
    2. Adam owes Tim $50, and Tim owes Euli $50 => This can change to Adam paying Euli $50 directly
    3. Adam owes Euli $100 + $50 = $150.

- #### A glance at a complex example of ten member's group:
<div align="center"><img alt="Ten_people_best_settle_solution" src="https://user-images.githubusercontent.com/62165222/195868659-2ea111ef-6848-4a19-ac78-4f704ce55cc2.gif" width="50%"/></div>

    1. Having 30 debts between group members
    2. Reduced to 9 debts after calculating by Raven Split algorithm

### Stragety:
1. Applied both relational database and graph database
RDS MySQl is used for saving raw data, balances as well as user and group datas. On the other hand, Neo4j is used to save the best settle solutions. 
With this structure, we can:
    - Guarantee the consistency of user data with the trait of relational database.
    - Take advantage of the graph database's relation base structure to fasten algorithm calculation.
<div align="center"><img alt="db_strategy" src="https://user-images.githubusercontent.com/62165222/195970547-b166e63c-aca2-4995-a92e-fb5139ebb384.png" width="70%"></div>

2. Implement Lambda and SQS to handle best settle calculation when needed
Considering the resouce-consuming by best settle calculation and the complexity of calculation itself influenced by the number of edges(payment relationships), it is not good either to conduct calculations per modification or wait until user requests.
Hence, implement the following design for improvement:

      - Counting the amount of expense modification, conduct best settle calculation once per 5 modifications.
      - Implement AWS Lambda for best settle calculation to ease the system loading. Produce job to AWS SQS to trigger Lambda when needed.
      - Separate prioritized queue to deal with immediate requests for checking the best settle solution from users.
      - Design check and lock system to avoid race-condition.

<div align="center"><img alt="lambda_strategy" src="https://user-images.githubusercontent.com/62165222/195971426-31ba9d39-0471-41a3-a28b-7281415d1e61.png"
width="70%"/></div>

## Tech Stack

**Server:** Node, Express

**Database:** RDS MySQL, Neo4j

**AWS Serverless Service:** Lambda, SQS

**Client:** React ([Front-End Repo](https://github.com/Eulisha/Raven-Split-Front-End)), Bootstrap, Material-UI

## Demo

- #### Dashboard: Check your current balance as well as debts at dashboard, click the debt row will lead you to the corresponding group to check more information.
<div align="center"><img alt="dashboard" src="https://user-images.githubusercontent.com/62165222/195968837-ac37f87a-cc42-4db6-be7b-9ed8a2d2cf51.gif" width="70%"/></div>

- #### Group: Check the balance of each member and organize shared expenses conveniently.
<div align="center"><img alt="group" src="https://user-images.githubusercontent.com/62165222/195969284-67416e25-85f2-4a9e-bb84-345352d90f75.gif" width="70%" /></div>

- #### Add expense: Add a record for shared expense. Use even/customized mode to split evenly quickly or enter input separately. The calculation helper below will check if the total of this expense is equal to the sum of the current split inputs.
<div align="center"><img alt="add_expense" src="https://user-images.githubusercontent.com/62165222/195963851-02adac2a-8afc-49f8-8316-e30875a2828b.gif" width="70%"/></div>

- #### Edit expense: Edit expense easily to fix any wrong input.
<div align="center"><img alt="edit_expense" src="https://user-images.githubusercontent.com/62165222/195963866-e7c2fd6a-27cd-4fe2-8556-7ed2d38adea5.gif" width="70%"/> </div>

- #### Delete expense: Delete expense easily if not needed anymore.
<div align="center"><img alt="delete_expense" src="https://user-images.githubusercontent.com/62165222/195963869-0d94be2c-0672-4651-b63b-1c05ced98f54.gif" width="70%"/></div>

- #### Settle pairly: Clear debt with anyone in the group anytime.
<div align="center"><img alt="settle_pair" src="https://user-images.githubusercontent.com/62165222/195965194-bda73240-43f6-41c3-813e-76d55ed96a33.gif" width="70%"/></div>

- #### Settle All: Settle up with whole group using Raven Split best settle solution.
<div align="center"><img alt="settle_all" src="https://user-images.githubusercontent.com/62165222/195965182-39e0693f-6faf-4bd2-9149-b38fa4f610f1.gif" width="70%"/></div>

- #### Create group: create your own group with friends.
<div align="center"><img alt="create_group" src="https://user-images.githubusercontent.com/62165222/195969335-b228454b-2b4c-42c7-95b4-20c5562839e5.gif"
width="70%"/></div>
