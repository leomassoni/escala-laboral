const { z } = require('zod')

function registerStateRoutes(app, stateStore) {
  const { appStateSchema, modularCollections } = stateStore

  app.get('/api/state', async (_request, response) => {
    const state = await stateStore.getStoredState()

    if (!state) {
      response.json({ state: null })
      return
    }

    response.json({
      state,
      updatedAt: state.updatedAt,
    })
  })

  app.put('/api/state', async (request, response) => {
    const state = appStateSchema.parse(request.body)

    const stored = await stateStore.persistState(state)

    response.json({
      ok: true,
      updatedAt: stored.updatedAt,
    })
  })

  modularCollections.forEach((collectionKey) => {
    app.get(`/api/${collectionKey}`, async (_request, response) => {
      const state = await stateStore.getStoredState()
      response.json({
        items: state?.[collectionKey] ?? [],
        updatedAt: state?.updatedAt ?? null,
      })
    })

    app.put(`/api/${collectionKey}`, async (request, response) => {
      const items = z.array(z.unknown()).parse(request.body?.items ?? request.body)
      const stored = await stateStore.updateStateCollection(collectionKey, items)
      response.json({
        ok: true,
        items,
        updatedAt: stored.updatedAt,
      })
    })
  })
}

module.exports = {
  registerStateRoutes,
}
