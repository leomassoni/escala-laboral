const { z } = require('zod')

const stateKey = 'default'
const modularCollections = [
  'agreements',
  'sectors',
  'functions',
  'collaboratorProfiles',
  'collaborators',
  'schedules',
  'scaleAssignments',
  'scaleComments',
  'scaleExtraRoster',
  'users',
  'auditLogs',
]

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
  auditLogs: z.array(z.unknown()).default([]),
})

function createStateStore(prisma) {
  async function getStoredState() {
    const stored = await prisma.appState.findUnique({ where: { key: stateKey } })
    if (!stored) {
      return null
    }

    return {
      version: stored.version,
      ...JSON.parse(stored.payload),
      updatedAt: stored.updatedAt,
    }
  }

  async function persistState(state) {
    return prisma.appState.upsert({
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
  }

  async function updateStateCollection(collectionKey, items) {
    const currentState = (await getStoredState()) ?? appStateSchema.parse({ version: 1 })
    const nextState = appStateSchema.parse({
      ...currentState,
      [collectionKey]: items,
    })

    return persistState(nextState)
  }

  return {
    appStateSchema,
    getStoredState,
    persistState,
    updateStateCollection,
    modularCollections,
  }
}

function stripVersion(state) {
  const { version, ...payload } = state
  return payload
}

module.exports = {
  appStateSchema,
  createStateStore,
  modularCollections,
}
