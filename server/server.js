const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { z } = require('zod')

loadEnvFile(path.join(__dirname, '.env'))

const prisma = new PrismaClient()
const app = express()
const port = Number(process.env.PORT || 4000)
const stateKey = 'default'
const clientDistPath = path.resolve(__dirname, '..', 'dist')

const appStateSchema = z.object({
  version: z.number().int().min(1).default(1),
  companies: z.array(z.unknown()).default([]),
  agreements: z.array(z.unknown()).default([]),
  sectors: z.array(z.unknown()).default([]),
  functions: z.array(z.unknown()).default([]),
  collaboratorProfiles: z.array(z.unknown()).default([]),
  collaborators: z.array(z.unknown()).default([]),
  schedules: z.array(z.unknown()).default([]),
  scaleAssignments: z.array(z.unknown()).default([]),
  scaleComments: z.array(z.unknown()).default([]),
  scaleExtraRoster: z.array(z.unknown()).default([]),
  users: z.array(z.unknown()).default([]),
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`
  response.json({ ok: true })
})

app.get('/api/state', async (_request, response) => {
  const stored = await prisma.appState.findUnique({ where: { key: stateKey } })

  if (!stored) {
    response.json({ state: null })
    return
  }

  response.json({
    state: {
      version: stored.version,
      ...JSON.parse(stored.payload),
    },
    updatedAt: stored.updatedAt,
  })
})

app.put('/api/state', async (request, response) => {
  const state = appStateSchema.parse(request.body)

  const stored = await prisma.appState.upsert({
    where: { key: stateKey },
    update: {
      version: state.version,
      payload: JSON.stringify(stripVersion(state)),
    },
    create: {
      key: stateKey,
      version: state.version,
      payload: JSON.stringify(stripVersion(state)),
    },
  })

  response.json({
    ok: true,
    updatedAt: stored.updatedAt,
  })
})

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

function stripVersion(state) {
  const { version, ...payload } = state
  return payload
}

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
