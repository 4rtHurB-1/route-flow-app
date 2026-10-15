# Pubs Scanner App
Pubs scanner PWA for scanning QR codes on literature and redirect to specified url    
Developed on Ember

## Deployment
[![Netlify Status](https://api.netlify.com/api/v1/badges/adfa4f33-654d-4392-b415-7537c6cd6ded/deploy-status)](https://app.netlify.com/sites/pubs-scanner/deploys)

## Installation

* `npm install`

## Running / Development

* `ember serve`

### Building

* `ember build` (development)
* `ember build --environment production` (production)


## Оновлення маршруту з історії

Розгорніть маршрут і натисніть «Редагувати маршрут». Усі адреси відкриються
в одному текстовому полі, кожна з нового рядка. Змініть, видаліть або додайте
адреси й натисніть «Оновити маршрут».
Усі адреси знову проходять пошук координат (включно з правилами конфігурації),
пошук додаткових даних за поточними налаштуваннями, визначення старту й
оптимізацію. Старі координати та результати API не використовуються.
Незнайдені адреси можна виправити, вказати посилання Visicom або видалити.

Оновлення замінює дані в тому самому записі localStorage: ID, дата створення,
назва закладки й статус збереження залишаються. Новий запис не додається.
У разі помилки попередній маршрут залишається доступним.
