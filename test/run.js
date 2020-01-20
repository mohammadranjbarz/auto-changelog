import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import remotes from './data/remotes'
import commits from './data/commits'
import run, {
  __get__,
  __Rewire__ as mock,
  __ResetDependency__ as unmock
} from '../src/run'

const getOptions = __get__('getOptions')

describe('getOptions', () => {
  it('parses commit limit correctly', async () => {
    const options = await getOptions(['', '', '--commit-limit', '10'])
    expect(options.commitLimit).to.equal(10)
  })

  it('parses false commit limit correctly', async () => {
    const options = await getOptions(['', '', '--commit-limit', 'false'])
    expect(options.commitLimit).to.equal(false)
  })

  it('parses --issue-url correctly when given --issue-url', async () => {
    const options = await getOptions(['', '', '--issue-url', 'https://test.issue.local/issues/{id}'])
    expect(options.issueUrl).to.equal('https://test.issue.local/issues/{id}')
  })

  it('parses -i correctly when given -i', async () => {
    const options = await getOptions(['', '', '-i', 'https://test.issue.local/issues/{id}'])
    expect(options.issueUrl).to.equal('https://test.issue.local/issues/{id}')
  })
})

describe('run', () => {
  beforeEach(() => {
    mock('fileExists', () => false)
    mock('readJson', () => null)
    mock('fetchRemote', () => remotes.github)
    mock('fetchCommits', () => commits)
    mock('writeFile', () => {})
    mock('log', () => {})
  })

  afterEach(() => {
    unmock('fileExists')
    unmock('readJson')
    unmock('fetchRemote')
    unmock('fetchCommits')
    unmock('writeFile')
    unmock('log')
  })

  it('uses version from package.json', async () => {
    mock('fileExists', () => true)
    mock('readJson', () => ({
      version: '2.0.0'
    }))
    mock('writeFile', (output, log) => {
      expect(log).to.include('v2.0.0')
    })

    return run(['', '', '--package'])
  })

  it('uses version from custom package file', async () => {
    mock('fileExists', () => true)
    mock('readJson', file => {
      if (file === 'test.json') {
        return { version: '2.0.0' }
      }
      return {}
    })
    mock('writeFile', (output, log) => {
      expect(log).to.include('v2.0.0')
    })

    return run(['', '', '--package', 'test.json'])
  })

  it('uses version from package.json with no prefix', async () => {
    mock('fileExists', () => true)
    mock('readJson', () => ({
      version: '2.0.0'
    }))
    mock('fetchCommits', () => commits.map(commit => {
      return {
        ...commit,
        tag: commit.tag ? commit.tag.replace('v', '') : null
      }
    }))
    mock('writeFile', (output, log) => {
      expect(log).to.include('2.0.0')
      expect(log).to.not.include('v2.0.0')
    })

    return run(['', '', '--package'])
  })

  it('command line options override options from package.json', async () => {
    mock('fileExists', () => true)
    mock('readJson', () => ({
      'adanic-auto-changelog': {
        output: 'should-not-be-this.md'
      }
    }))
    mock('writeFile', (output, log) => {
      expect(output).to.equal('should-be-this.md')
    })

    return run(['', '', '--output', 'should-be-this.md'])
  })

  it('command line options override options from .adanic-auto-changelog', async () => {
    mock('fileExists', () => true)
    mock('readJson', (path) => {
      return path === '.adanic-auto-changelog' ? { output: 'should-not-be-this.md' } : null
    })
    mock('writeFile', (output, log) => {
      expect(output).to.equal('should-be-this.md')
    })

    return run(['', '', '--output', 'should-be-this.md'])
  })

  it('supports unreleased option', () => {
    mock('writeFile', (output, log) => {
      expect(log).to.include('Unreleased')
      expect(log).to.include('https://github.com/user/repo/compare/v1.0.0...HEAD')
    })
    return run(['', '', '--unreleased'])
  })

  it('supports includeBranch option', () => {
    mock('fetchCommits', (remote, options, branch) => {
      if (branch === 'another-branch') {
        return commits.concat({
          date: '2015-12-15T12:03:09.000Z',
          tag: 'v0.2.0'
        })
      }
      return commits
    })
    mock('writeFile', (output, log) => {
      expect(log).to.include('v0.2.0')
    })
    return run(['', '', '--include-branch', 'another-branch'])
  })

  it('supports breakingPattern option', () => {
    mock('fetchCommits', () => commits.map(commit => {
      if (/Some breaking change/.test(commit.message)) {
        return { ...commit, breaking: true }
      }
      return commit
    }))
    mock('writeFile', (output, log) => {
      expect(log).to.include('**Breaking change:** Some breaking change')
    })
    // No need to actually pass in the option here as we amend the commits
    return run(['', '', '--commit-limit', '0'])
  })

  it('supports releaseSummary option', () => {
    mock('writeFile', (output, log) => {
      expect(log).to.include('This is my major release description.\n\n- And a bullet point')
    })
    return run(['', '', '--release-summary'])
  })

  it('does not error when using latest version option', () => {
    return run(['', '', '--latest-version', 'v3.0.0'])
  })

  it('does not error when using stdout option', () => {
    return run(['', '', '--stdout'])
  })

  it('throws an error when no package found', done => {
    run(['', '', '--package'])
      .then(() => done('Should throw an error'))
      .catch(() => done())
  })

  it('throws an error when no custom package found', done => {
    run(['', '', '--package', 'does-not-exist.json'])
      .then(() => done('Should throw an error'))
      .catch(() => done())
  })

  it('throws an error when no template found', done => {
    run(['', '', '--template', 'not-found'])
      .then(() => done('Should throw an error'))
      .catch(() => done())
  })

  it('throws an error when given an invalid latest version', done => {
    run(['', '', '--latest-version', 'invalid'])
      .then(() => done('Should throw an error'))
      .catch(() => done())
  })
})
