// Doctor hand-off: stores an encrypted summary the server cannot read, until it expires or is withdrawn.
import { toVercel } from '../infra/server/http.mjs'
import { handler } from '../infra/server/share.mjs'

export default toVercel(handler)
