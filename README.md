<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MotorLog — Local Run

## Prerequisites

- Node.js
- MSSQL (Docker recommended)

## 1) Start MSSQL (Docker)

```
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=Siemens123!" -p 2000:1433 -d --name mssql-server mcr.microsoft.com/mssql/server:latest
```

## 2) Install dependencies

```
npm install
```

## 3) Configure env

Create a `.env` file from [.env.example](.env.example) for the API server:

```
cp .env.example .env
```

Create a `.env.local` file for Vite and set:

```
VITE_DATA_SOURCE=mssql
VITE_API_BASE=http://localhost:4000
```

## 4) Run API server

```
npm run server
```

## 5) Run frontend

```
npm run dev
```
