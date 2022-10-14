import { str, num, strs, bool, now } from './utils'

export interface WordDefinitionVariation {
  example: str
  wordInExample: str
  image?: str // first variation may be without image
  imagePosition?: num
}

export class WordDefinitionDTO {
  order = 100
  level = 'b2'
  pos = 'noun'
  definition = ''
  trusted = false

  examples: strs
  selectedExample: str
  wordInSelectedExample: str

  exampleTranslation?: str // all 3 translations do not exist in GlobalWord
  definitionTranslation?: str
  shortTranslation?: str

  image?: str

  phrase?: str
  guideWord?: str
  synonyms?: strs

  offensive?: bool
  slang?: bool
  dated?: bool

  article?: str
  past?: str
  pastParticiple?: str

  constructor(word: str) {
    this.examples = [word]
    this.selectedExample = word
    this.wordInSelectedExample = word
  }
}
type ExampleTranslations = { [example: str]: str | undefined } // stored here for convenience

type DefinitionTranslation = { definition?: str; short?: str; examples?: ExampleTranslations }
export class GlobalWordDefinitionDTO extends WordDefinitionDTO {
  variations?: WordDefinitionVariation[]
  translations?: { [lang: str]: DefinitionTranslation }

  constructor(word: str) {
    super(word)
  }
}
export type GlobalWordDefinitionDTOs = { [id: str]: GlobalWordDefinitionDTO }

export class WordDTO {
  word = ''
  ipa = ''
  definitions = {} as GlobalWordDefinitionDTOs // the separation between global and personal is only for understanding
  pronunciation = '' // mp3 url or text to pass to speech synthesis
  lang?: str
}

export type ShortsStructure = { main: strs; other: strs }
export class GlobalWordDTO extends WordDTO {
  extraExamples?: strs // api cache
  shorts?: { [lang: string]: ShortsStructure } // api cache
  createdAt: num

  constructor(word = '') {
    super()
    this.word = word
    this.createdAt = now()
  }
}
