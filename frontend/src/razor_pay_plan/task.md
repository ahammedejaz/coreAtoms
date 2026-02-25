# Razorpay Payment Gateway Integration

## Completed
- [x] Fix admin redirect after OAuth login
- [x] Style admin buttons (Edit, Export CSV, Clear Filters, View Details, Close, Delete)
- [x] Add WhatsApp order status notification
- [x] Persist WhatsApp sent status to Supabase
- [x] Fix WhatsApp messages (emojis, domain, layout)
- [x] Mobile compatibility for Admin Orders
- [x] Center stat card text on Admin Dashboard

## In Progress
- [/] Razorpay Payment Gateway Integration
  - [ ] Database migration (payment_method, razorpay_payment_id columns + app_settings row)
  - [ ] Razorpay utility (razorpay.js — script loader + checkout opener)
  - [ ] Admin Settings toggle (ON/OFF switch for Razorpay)
  - [ ] Supabase Edge Function: create-razorpay-order
  - [ ] Supabase Edge Function: verify-razorpay-payment
  - [ ] Checkout.jsx — dual payment buttons (COD + Razorpay)
  - [ ] AdminOrders.jsx — payment method badge
