// background.js

importScripts('ExtPay.js') // or `import` / `require` if using a bundler

const extpay = ExtPay('color-analysis-shopper')
extpay.startBackground(); 

extpay.getUser().then(user => {
	console.log(user)
})