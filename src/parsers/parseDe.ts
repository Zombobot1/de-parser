import { GlobalWordDTO, GlobalWordDefinitionDTOs, GlobalWordDefinitionDTO } from '../dto'
import { safe, str, sort, uuid, removeUndefined, now, bool, strs, safeSplit, num } from '../utils'

const vowels = 'aeiou'

function parseDict(dictDiv: HTMLDivElement): GlobalWordDTO {
  const word = safe(dictDiv.querySelectorAll('.dhw')[0].textContent?.trim()).toLowerCase()
  let lastLevel: str | undefined = undefined
  let ipa = dictDiv.querySelectorAll('.pron')[0].textContent?.trim() || ''
  let pronunciation = ''
  const poses = [...dictDiv.querySelectorAll('.normal-entry-body')]
  // poses.forEach((posNode) => {})
  const definitions: GlobalWordDefinitionDTOs = {}
  return removeUndefined({ word, ipa, pronunciation, definitions, createdAt: now() })
}

export function parseCambridgePageDe(word: str, doc: Document): { word: GlobalWordDTO } {
  const dictionary = doc.querySelector<HTMLDivElement>('.dictionary')
  if (!dictionary) {
    // console.info(doc.documentElement.innerHTML) // Sometimes returns <head></head><body>Error: could not handle the request</body>
    word = word.replaceAll('.', '').toLowerCase()
    return { word: { ...new GlobalWordDTO(), word } }
  }
  const dto = parseDict(dictionary)
  dto.word = dto.word.replaceAll('.', '').toLowerCase() // . may break the appendToArray
  return { word: dto }
}
