import { GlobalWordDTO, GlobalWordDefinitionDTOs, GlobalWordDefinitionDTO } from '../dto'
import { safe, str, sort, uuid, removeUndefined, now, bool, strs, safeSplit, num } from '../utils'

const vowels = 'aeiou'

function parseDict(dictDiv: HTMLDivElement): GlobalWordDTO {
  const word = safe(dictDiv.querySelectorAll('.headword')[0].textContent?.trim()).toLowerCase()
  const poses = [...dictDiv.querySelectorAll('.entry-body__el')]
  let lastLevel: str | undefined = undefined
  let ipa = ''
  let pronunciation = ''
  const definitions = {} as GlobalWordDefinitionDTOs
  let order = 0
  poses.forEach((posNode) => {
    const pos = posNode.querySelectorAll('.pos')[0]?.textContent?.trim()
    const ipaCandidate = getIPA(posNode)
    const redirected = posNode.querySelectorAll('.x')[0]?.textContent?.trim()

    // have to redirect us spelling to uk spelling :(, do not know alternative
    const shouldRedirect = !pos || !ipaCandidate // neighbor has pos but doesn't have ipa
    if (shouldRedirect && redirected && !Object.keys(definitions)) throw new Error(`302${redirected}`) // sin has redirect in 3rd definition
    if (!pos) return // in sun there is Sun. that is abbreviation. it doesn't have pos
    if (!ipaCandidate) return // ipad doesn't have ipa

    if (shouldSkipPOS(posNode)) return

    const globalCountable = getCountable(posNode.querySelectorAll('.gram')[0]?.textContent || undefined)

    if (!ipa) ipa = safe(ipaCandidate)
    if (!pronunciation) pronunciation = getPron(posNode, word)

    const defs = [...posNode.querySelectorAll('.def-block')]
    defs.forEach((defNode) => {
      if (defNode.querySelectorAll('.def-info')[0]?.querySelectorAll('.region')[0]?.textContent === 'UK') return

      const { slang, offensive, dated } = getUsage(
        defNode.querySelectorAll('.def-info')[0]?.querySelectorAll('.usage')[0]?.textContent,
      )
      if (dated) return

      let countable = getCountable(defNode.querySelectorAll('.gram')[0]?.textContent || undefined)
      if (pos === 'noun' && !countable) countable = globalCountable
      const article = getArticle(word, countable)

      let level = defNode.querySelectorAll('.dxref')[0]?.textContent?.trim() || ''
      if (!level && lastLevel) level = lastLevel
      if (level) lastLevel = level

      const def = defNode.querySelectorAll('.def')[0]?.textContent
      if (!def) return // in warm there is warmth that doesn't have definition

      let definition = def.replace('→', '').replaceAll('\n', '').replaceAll(/[ ]+/g, ' ').trim()
      if (definition.at(-1) === ':') definition = definition.slice(0, -1)

      // past forms are stored in definition because poses are inlined and the forms cannot be stored in word, some words have different irreg e.g. "cost"
      const { past, pastParticiple } = getTenses([...posNode.querySelectorAll('span.inf-group.dinfg')])

      const phrase = getPhrase(defNode)
      const guideWord = getGuide(defNode)

      let examples = sort(
        [...defNode.querySelectorAll('.examp')].map((n) => clearExample(safe(n.textContent))),
        (e) => e.length,
      )

      // for more complex definitions we should prefer the shortest example, for simpler ones users can reselect
      if (!examples.length) examples.push(word)
      examples = shrinkExamples(examples, word, past, pastParticiple)

      const synonymsDiv = [...defNode.querySelectorAll('div.xref.synonyms')] // found in "little"
      const thesaurusDivs = [...defNode.querySelectorAll('div.daccord')]
      const synonyms = generateSynonyms(word, synonymsDiv, thesaurusDivs)

      const wordInSelectedExample = selectWordInExample(examples[0], word, past, pastParticiple)

      const r: GlobalWordDefinitionDTO = {
        order: order++,
        phrase,
        pos,
        article,
        past, // must be duplicated for redundancy (one of definition may be removed by user), somehow presented only in verbs (beat)
        pastParticiple,
        level,
        slang,
        offensive,
        definition,
        guideWord,
        examples,
        wordInSelectedExample,
        selectedExample: examples[0],
        trusted: true,
        synonyms,
      }

      if (r.pos.toLowerCase() === 'phrasal verb') {
        r.pos = 'verb'
        delete r.past
        delete r.pastParticiple
      }

      definitions[uuid({ short: true })] = r
    })
  })

  return removeUndefined(deduceLevels({ word, ipa, pronunciation, definitions, createdAt: now() }))
}

function shouldSkipPOS(posNode: Element): bool {
  const header = posNode.querySelectorAll('.pos-header')[0]
  return header?.querySelectorAll('.lab.dlab')[0]?.textContent?.trim() === 'UK'
}

function getIPA(posNode: Element): str {
  const usPron = posNode.querySelectorAll('.us.dpron-i')[0]
  let ipa = usPron?.querySelectorAll('.ipa')[0]?.textContent?.trim()
  if (!ipa) ipa = posNode.querySelectorAll('.ipa')[0]?.textContent?.trim()
  if (!ipa) return ''
  return ipa
}

function getPron(posNode: Element, word: str): str {
  const usPron = posNode.querySelectorAll('.us.dpron-i')[0]
  let pron = usPron?.querySelectorAll('source[src*=".mp3"]')[0]?.getAttribute('src')
  if (!pron) pron = posNode.querySelectorAll('source[src*=".mp3"]')[0]?.getAttribute('src')
  if (pron) return cambridgeBaseUrl + pron
  return pron || word
}

function shrinkExamples(examples: strs, word: str, past?: str, pastParticiple?: str): strs {
  return examples.map((e) => {
    const noBrackets = e.replaceAll(textInBrackets, '').trim()
    return handleSlash(noBrackets, word, past, pastParticiple)
  })
}

function getWordIndex(example: str, wordInExample: str) {
  const words = safeSplit(example, ' ')
  const wordIndex = words.indexOf(wordInExample)
  const alternativeIndex =
    wordIndex === -1 ? words.findIndex((w) => w.endsWith(wordInExample) || w.startsWith(wordInExample)) : -1 // wordInExample = m, example = I'm, same with prefix
  return { words, i: wordIndex, alternativeI: alternativeIndex }
}

export function splitExampleByWord(example: str, wordInExample?: str) {
  if (!wordInExample) return { before: example, word: '', after: '', left: '', right: '' }

  const exampleLower = cleanTextL(example)
  const wordLower = cleanTextL(wordInExample)

  const search = getWordIndex(exampleLower, wordLower)
  const i = search.i === -1 ? search.alternativeI : search.i
  if (i === -1) throw new Error(`Cannot find word ${wordInExample} in example ${example}`)

  const words = safeSplit(example, ' ')
  let dirtyWord = words[i]
  let left = ''
  let right = ''

  if (search.i === -1) {
    if (dirtyWord.toLowerCase().startsWith(wordInExample.toLowerCase())) {
      right = dirtyWord.slice(wordInExample.length) // bad: + ' ' // ' ' just in case there is word after suffix
    } else if (dirtyWord.toLowerCase().endsWith(wordInExample.toLowerCase()))
      left = dirtyWord.slice(0, dirtyWord.length - wordInExample.length)

    dirtyWord = wordInExample // otherwise all word is selected instead of prefix/suffix
  } else {
    left = dirtyWord.startsWith('"') ? '"' : ''
    right = dirtyWord.match(/[!?,.:;"]$/g) ? safe(dirtyWord.at(-1)) : ''
  }

  const word = dirtyWord.replaceAll(/[!?,.:;"]/g, '') // word can be capitalized but doesn't contain punctuation

  let before = words.slice(0, i).join(' ')
  if (before && !left) before += ' '

  let after = words.slice(i + 1).join(' ')
  if (after) after = ' ' + after

  return { before, after, word, left, right }
}

const cleanTextL = (text: str) => text.replaceAll(/[!?,.:;"]/g, '').toLowerCase()
const cleanText = (text: str) => text.replaceAll(/[!?,.:;"]/g, '')

export function selectWordInExample(
  example: str,
  word: str,
  pastForm?: str,
  pastParticiple?: str,
  wordInExample?: str,
): str {
  if (wordInExample) {
    const search = getWordIndex(cleanTextL(example), cleanTextL(wordInExample || '')) // example may be edited and not contain word anymore
    if (search.i !== -1 || search.alternativeI !== -1) return wordInExample // no need to search
  }

  return determineWordFormInExample(example, word, pastForm, pastParticiple)
}

export function verifyWordInExample(example: str, wordInExample: str): bool {
  const search = getWordIndex(cleanTextL(example), cleanTextL(wordInExample))
  return search.i !== -1 || search.alternativeI !== -1
}

// requires clean text data
function _determineWordFormInExample(example: str, w: str, past?: str, pastParticiple?: str): num {
  const end = w.at(-1) || ''
  const wordVariations = [w + 's', w + 'es', w + end + 'ed', w + 'ed', w + 'd', w + end + 'ing', w + 'ing']

  if (past) wordVariations.push(...past.split(' or '))
  if (pastParticiple) wordVariations.push(...pastParticiple.split(' or '))
  wordVariations.push(w)

  let i = -1
  for (const word of wordVariations) {
    const search = getWordIndex(example, word)
    if (search.i !== -1) {
      i = search.i
      break
    }
  }

  if (i === -1) {
    for (const word of wordVariations) {
      const search = getWordIndex(example, word)
      if (search.alternativeI !== -1) {
        i = search.alternativeI
        break
      }
    }
  }

  return i
}

function determineWordFormInExample(example: str, w: str, past?: str, pastParticiple?: str): str {
  const i = _determineWordFormInExample(cleanTextL(example), cleanTextL(w), past, pastParticiple)
  if (i === -1) return ''
  return cleanText(example).split(' ')[i] // word may contain .
}

// Cake: Would you like a piece of/a slice of/some cake? | He made/baked a delicious cake. | a birthday/Christmas cake
// Point: Yes, I can see your point/you've got a point there.
// Sit: The town sits at/in the bottom of a valley
function handleSlash(example: str, word: str, past?: str, pastParticiple?: str) {
  if (!example.includes('/')) return example

  const twoOptions = example.replaceAll(/\/.*\//g, '/')

  const cutTillTheEnd = twoOptions.replaceAll(textAfterSlash, '').trim()
  const cutPart = twoOptions.slice(cutTillTheEnd.length)

  const hasWordBeforeCut = determineWordFormInExample(cutTillTheEnd, word, past, pastParticiple)
  const hasWordAfterCut = determineWordFormInExample(cutPart, word, past, pastParticiple)
  if (hasWordBeforeCut && hasWordAfterCut) return cutTillTheEnd

  const cutTillTheFirstSpace = twoOptions.replaceAll(textAfterSlashBeforeSpace, '')
  return cutTillTheFirstSpace.trim()
}

// function test() {
//   let r = handleSlash('Would you like a piece of/a slice of/some cake?', 'cake')
//   if (r !== 'Would you like a piece of cake?') console.error(r)
//   r = handleSlash('He made/baked a delicious cake.', 'cake')
//   if (r !== 'He made a delicious cake.') console.error(r)
//   r = handleSlash('a birthday/Christmas cake', 'cake')
//   if (r !== 'a birthday cake') console.error(r)
//   r = handleSlash("Yes, I can see your point/you've got a point there.", 'point')
//   if (r !== 'Yes, I can see your point.') console.error(r)
//   r = handleSlash('The town sits at/in the bottom of a valley', 'sit')
//   if (r !== 'The town sits at the bottom of a valley') console.error(r)
// }

const textInBrackets = / \(.*\)/g
const textAfterSlash = /\/[^!,.?]*/g
const textAfterSlashBeforeSpace = /\/[^ !,.?]*/g

function getPhrase(defNode: Element): str | undefined {
  if (defNode.parentElement?.classList.contains('phrase-body')) {
    const parent = defNode.parentNode
    let phrase = parent?.parentNode?.querySelectorAll('.phrase-title')[0]?.textContent || undefined
    if (phrase)
      phrase = phrase
        .replace('someone/something', 'sth')
        .replace('someone', 'sth')
        .replace('something', 'sth')
        .replace('etc.', '...')
        .trim()
    return phrase
  }
}

function getUsage(usage: str | null): { offensive?: bool; slang?: bool; dated?: bool } {
  if (!usage) return {}

  if (usage.includes('dated')) return { dated: true }
  if (usage.includes('old-fashioned')) return { dated: true }

  if (['slang offensive', 'offensive slang'].includes(usage)) return { slang: true, offensive: true } // haven't seen 2nd one 'offensive slang'
  if (['informal offensive', 'offensive informal'].includes(usage)) return { slang: true, offensive: true } // assume their existence
  if (usage.includes('informal')) return { slang: true }
  if (usage.includes('slang')) return { slang: true }
  if (usage.includes('offensive')) return { offensive: true }

  return {}
}

function clearExample(example: str): str {
  return example.replace(/\[.*\]/g, '').trim() // random text may be in braces: [ + two objects ] Can I get you a drink?
}

const cambridgeBaseUrl = 'https://dictionary.cambridge.org'

function deduceLevels(word: GlobalWordDTO): GlobalWordDTO {
  const definitions: GlobalWordDefinitionDTO[] = []
  const needLevel: GlobalWordDefinitionDTO[] = []

  for (const def of Object.values(word.definitions)) {
    if (!def.level) needLevel.push(def)
    definitions.push(def)
  }

  for (const lacksLevel of needLevel) {
    let i = definitions.findIndex((d) => d === lacksLevel) + 1

    let foundLevel = 'b2'
    while (i < definitions.length) {
      if (definitions[i].level) {
        foundLevel = safe(definitions[i].level)
        break
      }
      i++
    }

    lacksLevel.level = foundLevel
  }
  return word
}

function getCountable(text?: str): str | undefined {
  if (!text) return undefined
  return text.replace('[', '').replace(']', '').trim()
}

function getArticle(word: str, countable?: str): str | undefined {
  // countable can be U | C | U or C => consider only C as countable (to avoid generation of unnecessary flashcards)
  if (countable && ['C', 'S', 'usually singular'].includes(countable)) return getAorAn(word)
}

export function getAorAn(word: str): str {
  if (vowels.includes(word.toLowerCase()[0])) return 'an'
  return 'a'
}

function getGuide(defBlock: Element) {
  const guide = defBlock.parentElement?.parentElement?.querySelectorAll('.guideword')[0] // . sense-body . pr dense
  let word = guide?.textContent
  if (word) {
    word = word.replace(/\(|\)/g, '').trim() // remove surrounding brackets
    if (word.includes('/')) word = word.split('/')[0].trim() // may contain several guide words
  }
  return word || undefined
}

function getTenses(irreg: Element[]): { past?: str; pastParticiple?: str } {
  // may include "past participle" (go)
  // may include "or US usually gotten"
  // can be "sewn or sewed"
  const tenses = irreg
    .flatMap((i) => [...i.querySelectorAll('b')].map((b) => b.textContent?.trim()) || [])
    .filter((i) => i && !i.endsWith('ing'))
  const past = tenses[0]
  // "cost" will result in multiple or-s -> slice only two
  const pastParticiple = tenses.slice(1, 3).join(' or ') || undefined // do not return ''
  return { past, pastParticiple }
}

function generateSynonyms(word: str, synonymsDivs: Element[], thesaurusDivs: Element[]): strs {
  const r = new Set<str>()

  if (synonymsDivs.length) {
    const div = synonymsDivs[0]
    const underscored = [...div.querySelectorAll('a')]

    for (const a of underscored) {
      if (!a.textContent) continue
      r.add(removeBrackets(a.textContent.trim())) // some examples may contain original word in brackets
    }
  }

  for (const div of thesaurusDivs) {
    if (!div.textContent?.includes('Thesaurus: synonyms, antonyms, and examples')) continue
    const synonyms = [...(div.querySelectorAll('ul')[0]?.querySelectorAll('a') || [])]
    synonyms.forEach((s) => {
      const clean = s.textContent?.trim()
      if (clean) r.add(clean)
    })
  }

  const filtered = [...r].filter((s) => s !== word.toLowerCase()) // may contain original word
  return sort(filtered, (s) => s.length).slice(0, 3)
}

// function that removes all content in brackets ()
function removeBrackets(str: str) {
  return str.replace(/\(.*\)/g, '').trim()
}

export function parseCambridgePage(
  word: str,
  doc: Document,
  { redirected = false } = {},
): { word: GlobalWordDTO; redirected?: bool } {
  const dictionary = doc.querySelector<HTMLDivElement>('.dictionary')
  if (!dictionary) {
    // console.info(doc.documentElement.innerHTML) // Sometimes returns <head></head><body>Error: could not handle the request</body>
    word = word.replaceAll('.', '').toLowerCase()
    return { word: { ...new GlobalWordDTO(), word } }
  }
  const dto = parseDict(dictionary)
  dto.word = dto.word.replaceAll('.', '').toLowerCase() // . may break the appendToArray
  return { word: dto, redirected: dto.word !== word || redirected }
}
