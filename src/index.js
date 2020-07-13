#!/usr/bin/env node

import 'core-js/stable'
import run from './run'

export const generateChangelog = async (output, tagPattern = '') => {
  console.log('process.argv', process.argv)

  if (!output) {
    throw new Error('output should be a valid path')
  }
  console.log('generateChangelog called', { output, tagPattern })
  return run(process.argv.concat(['--output', output, '--tag-pattern', tagPattern]))
}
