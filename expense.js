/*
expense tracker -- version 0
- high-level replication of app and its functionality
- data will be maintained in an array
- expense will be an object with properties:
    * title: string
    * category: string
    * amount: number
    * timestamp: string
- will contain 3 basic functions:
    * add transaction
    * delete transaction
    * display all transactions
*/
const {database} = require('./database');


async function addTransaction(title, category, amount){
    try{
        let converted_amount = Number(amount)

        if (Number.isNaN(converted_amount)){
            throw new Error('amount must be a number');
        }
   
        await database.expenses.create({
            data: {
                title: title,
                category: category,
                amount: converted_amount,
                timestamp: formattedDate()
            }
        })
        return true
        
    }catch(error){
        console.log("cannot add transaction, please try again");
        throw error;
    }
}

function formattedDate(){
    let date = new Date();
    let year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate(); 

    if (month.toString().length < 2){
        month = '0' + month;
    }

    if (day.toString().length < 2){
        day = '0' + day;
    }

    let timestamp = `${year.toString()}-${month}-${day}`;

    return timestamp;
}

async function deleteTransaction(inputNumber){
   try{
        const deleted_expense = await database.expenses.delete({
            where:{
                id: inputNumber
            }
        })
        return (deleted_expense)
   }catch(error){
        console.log("transaction does not exist");
   }
}

async function listExpenses(){
    try{
        const expense_list = await database.expenses.findMany();
        return expense_list;

    }catch(error){
        console.log(error)
        throw error;
    }
}

module.exports = {
   addTransaction,
   listExpenses,
   deleteTransaction
};
