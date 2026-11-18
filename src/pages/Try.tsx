import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { today } from '../lib/companion/dates'
import { personaData } from '../lib/companion/personas'
import type { PersonaId } from '../lib/companion/personas'
import { PERSONA_IDS } from '../lib/companion/personas'
import { openExample, save } from '../lib/storage'

/** Opens an example person in this tab (their own storage area), then reloads into the companion. */
export default function Try() {
  const { id } = useParams()
  const nav = useNavigate()
  useEffect(() => {
    if (!id || !PERSONA_IDS.includes(id as PersonaId)) {
      nav('/', { replace: true })
      return
    }
    openExample(id)
    for (const [k, v] of Object.entries(personaData(id as PersonaId, today()))) save(k, v)
    window.location.hash = '#/me'
    window.location.reload()
  }, [id, nav])
  return null
}
