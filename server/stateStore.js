const { z } = require('zod')

const stateKey = 'default'
const companySchema = z
  .object({
    id: z.number().int(),
    linkedCompanyIds: z.array(z.number().int()).default([]),
  })
  .passthrough()
const functionSchema = z
  .object({
    id: z.number().int(),
    companyId: z.number().int(),
    name: z.string(),
    sector: z.string(),
    description: z.string().optional().default(''),
    isActive: z.boolean().optional().default(true),
    inactivePeriods: z.array(z.unknown()).optional().default([]),
  })
  .passthrough()
const scheduleSchema = z
  .object({
    id: z.number().int(),
    companyId: z.number().int(),
    shiftName: z.string(),
    abbreviation: z.string(),
    isActive: z.boolean().optional().default(true),
    inactivePeriods: z.array(z.unknown()).optional().default([]),
  })
  .passthrough()

const collectionSchemas = {
  companies: z.array(companySchema),
  agreements: z.array(z.unknown()),
  sectors: z.array(z.unknown()),
  functions: z.array(functionSchema),
  collaboratorProfiles: z.array(z.unknown()),
  collaborators: z.array(z.unknown()),
  schedules: z.array(scheduleSchema),
  scaleAssignments: z.array(z.unknown()),
  scaleComments: z.array(z.unknown()),
  scaleExtraRoster: z.array(z.unknown()),
  users: z.array(z.unknown()),
  auditLogs: z.array(z.unknown()),
}

const modularCollections = Object.keys(collectionSchemas)

const appStateSchema = z.object({
  version: z.number().int().min(1).default(1),
  companies: collectionSchemas.companies.default([]),
  agreements: collectionSchemas.agreements.default([]),
  sectors: collectionSchemas.sectors.default([]),
  functions: collectionSchemas.functions.default([]),
  collaboratorProfiles: collectionSchemas.collaboratorProfiles.default([]),
  collaborators: collectionSchemas.collaborators.default([]),
  schedules: collectionSchemas.schedules.default([]),
  scaleAssignments: collectionSchemas.scaleAssignments.default([]),
  scaleComments: collectionSchemas.scaleComments.default([]),
  scaleExtraRoster: collectionSchemas.scaleExtraRoster.default([]),
  users: collectionSchemas.users.default([]),
  auditLogs: collectionSchemas.auditLogs.default([]),
})

function sanitizeCompanies(companies) {
  const existingCompanyIds = new Set(companies.map((item) => item.id))

  return companies.map((item) => ({
    ...item,
    linkedCompanyIds: Array.from(
      new Set(
        (Array.isArray(item.linkedCompanyIds) ? item.linkedCompanyIds : []).filter(
          (linkedCompanyId) => linkedCompanyId !== item.id && existingCompanyIds.has(linkedCompanyId),
        ),
      ),
    ).sort((left, right) => left - right),
  }))
}

function normalizeAppState(state) {
  const parsedState = appStateSchema.parse(state)

  return {
    ...parsedState,
    companies: sanitizeCompanies(parsedState.companies),
  }
}

function createStateStore(prisma) {
  async function getStoredState() {
    const stored = await prisma.appState.findUnique({ where: { key: stateKey } })
    if (!stored) {
      return null
    }

    const normalizedState = normalizeAppState({
      version: stored.version,
      ...JSON.parse(stored.payload),
    })

    return {
      ...normalizedState,
      updatedAt: stored.updatedAt,
    }
  }

  async function persistState(state) {
    const normalizedState = normalizeAppState(state)

    return prisma.appState.upsert({
      where: { key: stateKey },
      update: {
        version: normalizedState.version,
        payload: JSON.stringify(stripVersion(normalizedState)),
      },
      create: {
        key: stateKey,
        version: normalizedState.version,
        payload: JSON.stringify(stripVersion(normalizedState)),
      },
    })
  }

  async function updateStateCollection(collectionKey, items) {
    const currentState = (await getStoredState()) ?? normalizeAppState({ version: 1 })
    const collectionSchema = collectionSchemas[collectionKey] ?? z.array(z.unknown())
    const nextState = normalizeAppState({
      ...currentState,
      [collectionKey]: collectionSchema.parse(items),
    })

    return persistState(nextState)
  }

  return {
    appStateSchema,
    collectionSchemas,
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
  collectionSchemas,
  createStateStore,
  modularCollections,
}
