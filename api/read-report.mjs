// Lab report reader: the AI transcribes the numbers from a photo of a semen analysis report.
import { handler } from '../infra/ai/report.mjs'
import { toVercel } from '../infra/server/http.mjs'

export default toVercel(handler)
