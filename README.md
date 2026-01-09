# expenze-Expense Tracker
 
This is a small web project I built using plain HTML, CSS, and JavaScript.
The idea was to practice working with a real API and managing expenses in a simple way.
The app allows you to view expenses with pagination, search through them,
add new expenses, edit existing ones, and delete them.
All changes are synced with the server.
The total amount is calculated dynamically based on the currently loaded expenses,
and the interface updates automatically after each action.
API base URL:
https://pennypath-server.vercel.app

Endpoints used:
- GET /api/v1/expenses
- GET /api/v1/expenses/:expenseId
- POST /api/v1/expenses
- PUT /api/v1/expenses/:expenseId
- DELETE /api/v1/expenses/:expenseId
