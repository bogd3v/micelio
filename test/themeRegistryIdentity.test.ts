import { describe, expect, it } from 'vitest'
import { DEFAULT_REGISTRY, DEFAULT_SIGNER } from '../modules/theme/registry/constants'
import { RegistryError } from '../modules/theme/registry/error'
import { identityFor, parseIdentity } from '../modules/theme/registry/identity'

const ISSUER = 'https://token.actions.githubusercontent.com'
const PACKAGE = 'https://github.com/example/themes/.github/workflows/publish.yml@refs/heads/main'
const INDEX = 'https://github.com/example/themes/.github/workflows/index.yml@refs/heads/main'

describe('the signer of the default registry', () => {
  it('is a constant of the core: the issuer and the exact workflows of the theme registry', () => {
    expect(DEFAULT_SIGNER.issuer).toBe(ISSUER)
    expect(DEFAULT_SIGNER.packages).toBe('https://github.com/bogd3v/micelio-themes/.github/workflows/publish.yml@refs/heads/main')
    expect(DEFAULT_SIGNER.index).not.toBe(DEFAULT_SIGNER.packages)
  })

  it('applies to the default registry whatever the environment says', () => {
    expect(identityFor(DEFAULT_REGISTRY, {})).toEqual(DEFAULT_SIGNER)
    expect(identityFor(DEFAULT_REGISTRY, { MICELIO_THEME_REGISTRY: DEFAULT_REGISTRY, MICELIO_THEME_REGISTRY_IDENTITY: `issuer=${ISSUER},package=${PACKAGE}` })).toEqual(DEFAULT_SIGNER)
  })
})

describe('the signer of another registry', () => {
  const env = { MICELIO_THEME_REGISTRY: 'registry.example.com/themes', MICELIO_THEME_REGISTRY_IDENTITY: `issuer=${ISSUER},package=${PACKAGE},index=${INDEX}` }

  it('is whatever MICELIO_THEME_REGISTRY_IDENTITY says, for that registry only', () => {
    expect(identityFor('registry.example.com/themes', env)).toEqual({ issuer: ISSUER, packages: PACKAGE, index: INDEX })
    expect(identityFor('other.example.com/themes', env)).toBeNull()
  })

  it('is unknown without the variable, so nothing is installed from it', () => {
    expect(identityFor('registry.example.com/themes', { MICELIO_THEME_REGISTRY: 'registry.example.com/themes' })).toBeNull()
  })

  it('signs the index with the package identity when no index is given', () => {
    expect(parseIdentity(`issuer=${ISSUER},package=${PACKAGE}`).index).toBe(PACKAGE)
  })

  it.each([
    [''], ['issuer'], [`issuer=${ISSUER}`], [`package=${PACKAGE}`], [`issuer=${ISSUER},package=${PACKAGE},package=${PACKAGE}`],
    [`issuer=${ISSUER},package=http://example.com/x`], [`issuer=${ISSUER},package=${PACKAGE},extra=https://example.com`],
    [`issuer=${ISSUER},package=https://example.com/a b`], [`issuer=${ISSUER},package=.*`], [`issuer=${ISSUER},package=https://${'a'.repeat(600)}`],
  ])('refuses %j', (text) => {
    expect(() => parseIdentity(text)).toThrow(RegistryError)
  })
})
