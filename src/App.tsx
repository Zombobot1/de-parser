import { useQuery } from 'react-query'
import { parseCambridgePage } from './parsers/parseEn'
import { parseCambridgePageDe } from './parsers/parseDe'
import rawCat from './parsers/rawCatEn.txt'
import rawCatDe from './parsers/rawCatDe.txt'
import { safe } from './utils'

export function App() {
  const { data: html } = useQuery(rawCat, () => fetch(rawCat).then((r) => r.text()))

  const doc = new DOMParser().parseFromString(safe(html), 'text/html')
  const data = parseCambridgePage('cat', doc)

  // TODO: comment out the above and uncomment the below and implement it

  // const { data: html } = useQuery(rawCatDe, () => fetch(rawCatDe).then((r) => r.text()))

  // const doc = new DOMParser().parseFromString(safe(html), 'text/html')
  // const data = parseCambridgePageDe('cat', doc)

  return (
    <>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </>
  )
}
