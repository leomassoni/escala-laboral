const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { z } = require('zod')
const { createStateStore } = require('./stateStore')
const { registerStateRoutes } = require('./stateRoutes')

loadEnvFile(path.join(__dirname, '.env'))

const prisma = new PrismaClient()
const stateStore = createStateStore(prisma)
const app = express()
const port = Number(process.env.PORT || 4000)
const clientDistPath = path.resolve(__dirname, '..', 'dist')

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`
  response.json({ ok: true })
})

registerStateRoutes(app, stateStore)

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))

  app.get(/^(?!\/api\/).*/, (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next()
      return
    }

    response.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use((error, _request, response, _next) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: 'Payload de persistencia invalido.',
      issues: error.issues,
    })
    return
  }

  console.error(error)
  response.status(500).json({ error: 'Erro interno do servidor.' })
})

app.listen(port, () => {
  console.log(`Escala Laboral API em http://localhost:${port}`)
})

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const fileContents = fs.readFileSync(filePath, 'utf8')
  fileContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) {
        return
      }

      const key = line.slice(0, separatorIndex).trim()
      const rawValue = line.slice(separatorIndex + 1).trim()
      const normalizedValue = rawValue.replace(/^"(.*)"$/, '$1')

      if (!process.env[key]) {
        process.env[key] = normalizedValue
      }
    })
}
