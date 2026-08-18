export const WEALTHSIMPLE_CSV = `date,transaction,description,amount,balance
2026-07-02,SPEND,STARBUCKS #4521 TORONTO ON,-6.45,1243.55
2026-07-02,SPEND,STARBUCKS #4521 TORONTO ON,-6.45,1237.10
2026-07-03,SPEND,LOBLAWS #1044 TORONTO ON,-84.12,1152.98
2026-07-04,AFT_IN,PAYROLL DEPOSIT ACME CORP,2150.00,3302.98
2026-07-05,SPEND,NETFLIX.COM 866-579-7172 ON,-18.99,3283.99
2026-07-08,E-TRANSFER,E-TRANSFER TO JOHN DOE,-120.00,3163.99
`;

export const SCOTIABANK_CSV = `7/02/2026,-42.80,,"POS Purchase","METRO #567 TORONTO ON"
7/03/2026,-15.25,,"POS Purchase","TIM HORTONS #2210 TORONTO ON"
7/04/2026,2150.00,,"Deposit","PAYROLL DEPOSIT ACME CORP"
7/06/2026,-500.00,,"Transfer","TFR-TO WEALTHSIMPLE CASH"
7/07/2026,-64.99,,"Bill Payment","ROGERS COMMUNICATIONS"
`;

// Real Wealthsimple credit card export shape (anonymized).
export const WEALTHSIMPLE_CREDIT_CSV = `"transaction_date","post_date","type","details","amount","currency"
"2026-07-04","2026-07-05","Purchase","STM ATWATER SIE101","14.0","CAD"
"2026-07-04","2026-07-05","Purchase","MTL MUNCHIZ","20.0","CAD"
"2026-07-07","2026-07-07","Payment","From chequing account","-1234.56","CAD"
"2026-07-13","2026-07-13","Refund settled","UBER HOLDINGS CANADA INC.","14.92","CAD"
"2026-07-13","2026-07-13","Refund initiated","UBER HOLDINGS CANADA INC.","-14.92","CAD"
"2026-07-13","2026-07-13","Refund settled","UBER HOLDINGS CANADA INC.","-14.92","CAD"
"2026-06-04","2026-06-04","Monthly fee","","220.0","CAD"
`;

// Real Scotiabank chequing PDF text shape (anonymized): withdrawn/deposited
// columns collapse to one amount + balance; payee details wrap to next line.
export const SCOTIA_PDF_TEXT = `Page 1 of 1
Call 1 800 4-SCOTIA
www.scotiabank.com
Your Preferred Package account summary
Opening Balance on April 27, 2026 $100.00
Minus total withdrawals $50.00
Plus total deposits $1,600.00
Closing Balance on April 30, 2026 $1,650.00
Here's what happened in your account this statement period
Amounts Amounts
Date Transactions withdrawn ($) deposited ($) Balance ($)
Apr 27 Opening Balance 100.00
Apr 27 Deposit 0.00 100.00
Apr 27 Deposit 100.00 200.00
39763542 Free Interac E-Transfer
Apr 28 Withdrawal 50.00 150.00
Apr 29 Payroll dep. 1,500.00 1,650.00
Maple Widgets Payroll Inc.
Apr 30 Closing Balance $1,650.00
`;

// Shape of unpdf-extracted text from a credit card statement.
export const STATEMENT_PDF_TEXT = `Wealthsimple Card Statement
Statement period: July 1, 2026 to July 31, 2026

TRANSACTIONS
Jul 3  Jul 4  UBER EATS TORONTO ON  32.50
Jul 9  Jul 10  CINEPLEX #7002 TORONTO ON  24.99
Jul 15  Jul 16  PAYMENT - THANK YOU  400.00-
Jul 22  Jul 23  DOLLARAMA #445 TORONTO ON  8.47

Previous balance 512.33
New balance 178.29
`;
