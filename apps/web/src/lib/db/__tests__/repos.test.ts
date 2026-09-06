import { describe, it, expect } from 'vitest'
import { getSiteBySlug, createSite } from '../repos/sites'
import { createUser, getUserByEmail } from '../repos/users'
import {
  createPage,
  getPageBySlug,
  getPublishedPageBySlug,
  getPublishedPages,
  getPageBacklinks,
  searchPages,
} from '../repos/pages'
import { getAllTagsWithCount, getPagesByTagSlug } from '../repos/tags'

describe('Database Repositories', () => {
  const uniqueRunId = Date.now().toString()

  it('can create and fetch a site', async () => {
    const slug = `test-site-${uniqueRunId}`
    const newSite = await createSite({
      name: 'Test Site',
      slug,
    })

    expect(newSite).toBeDefined()
    expect(newSite.slug).toBe(slug)

    const fetched = await getSiteBySlug(slug)
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(newSite.id)
  })

  it('can create and fetch a user', async () => {
    const email = `test-${uniqueRunId}@example.com`
    const newUser = await createUser({
      email,
      passwordHash: 'dummyhash',
    })

    expect(newUser).toBeDefined()
    expect(newUser.email).toBe(email)

    const fetched = await getUserByEmail(email)
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(newUser.id)
  })

  it('can create and fetch a page', async () => {
    const slug = `test-page-site-${uniqueRunId}`
    const newSite = await createSite({
      name: 'Test Page Site',
      slug,
    })

    const newPage = await createPage({
      siteId: newSite.id,
      sourceId: `src-${uniqueRunId}`,
      path: 'test-path.md',
      title: 'Test Title',
      slug: 'test-slug',
      markdown: '# Test',
      frontmatter: {},
      status: 'published',
      contentHash: 'testhash',
    })

    expect(newPage).toBeDefined()
    expect(newPage.siteId).toBe(newSite.id)

    const fetched = await getPageBySlug(newSite.id, 'test-slug')
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(newPage.id)
  })

  it('reads seeded published pages, backlinks, and tags', async () => {
    const site = await getSiteBySlug('default')
    expect(site).not.toBeNull()
    if (!site) return

    // 1. Test getPublishedPages
    const published = await getPublishedPages(site.id)
    expect(published.length).toBeGreaterThanOrEqual(3)

    // 2. Test getPublishedPageBySlug with tags
    const home = await getPublishedPageBySlug(site.id, 'home')
    expect(home).not.toBeNull()
    expect(home?.slug).toBe('home')
    expect(home?.tags.length).toBeGreaterThanOrEqual(1)

    // 3. Test getPageBacklinks (getting-started should be linked from home and architecture-guide)
    const gettingStarted = await getPublishedPageBySlug(
      site.id,
      'getting-started',
    )
    expect(gettingStarted).not.toBeNull()
    if (gettingStarted) {
      const backlinks = await getPageBacklinks(gettingStarted.id)
      expect(backlinks.length).toBeGreaterThanOrEqual(1)
      const linkerSlugs = backlinks.map((b) => b.slug)
      expect(linkerSlugs).toContain('home')
    }

    // 4. Test searchPages
    const searchResults = await searchPages(site.id, 'Obsidian')
    expect(searchResults.length).toBeGreaterThanOrEqual(1)

    // 5. Test getAllTagsWithCount
    const tagsWithCount = await getAllTagsWithCount(site.id)
    expect(tagsWithCount.length).toBeGreaterThanOrEqual(2)
    const guideTag = tagsWithCount.find((t) => t.slug === 'guide')
    expect(guideTag).toBeDefined()
    expect(guideTag?.count).toBeGreaterThanOrEqual(1)

    // 6. Test getPagesByTagSlug
    const guideTagResult = await getPagesByTagSlug(site.id, 'guide')
    expect(guideTagResult.tag).not.toBeNull()
    expect(guideTagResult.pages.length).toBeGreaterThanOrEqual(1)
  })
})
