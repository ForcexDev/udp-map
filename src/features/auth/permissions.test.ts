import { describe, expect, it } from 'vitest'
import { can, isUdpEmail } from './permissions'

describe('can() — matriz de permisos del plan §3', () => {
  it('guest solo consume: ve pero no escribe', () => {
    expect(can('guest', 'pin.view')).toBe(true)
    expect(can('guest', 'pin.create.report')).toBe(false)
    expect(can('guest', 'pin.comment')).toBe(false)
    expect(can('guest', 'pin.vote')).toBe(false)
    expect(can('guest', 'event.rsvp')).toBe(false)
    expect(can('guest', 'forum.post')).toBe(false)
    expect(can('guest', 'forum.postOfficial')).toBe(false)
    expect(can('guest', 'content.report')).toBe(false)
  })

  it('student crea reports/eventos, comenta y vota, pero no gestiona lugares', () => {
    expect(can('student', 'pin.create.report')).toBe(true)
    expect(can('student', 'pin.create.event')).toBe(true)
    expect(can('student', 'pin.comment')).toBe(true)
    expect(can('student', 'pin.vote')).toBe(true)
    expect(can('student', 'pin.delete.own')).toBe(true)
    expect(can('student', 'pin.create.place')).toBe(false)
    expect(can('student', 'pin.makePermanent')).toBe(false)
    expect(can('student', 'pin.moderate')).toBe(false)
    expect(can('student', 'users.manage')).toBe(false)
  })

  it('moderator gestiona lugares, oficializa eventos, modera y verifica o extiende pines', () => {
    expect(can('moderator', 'forum.post')).toBe(true)
    expect(can('moderator', 'forum.postOfficial')).toBe(true)
    expect(can('moderator', 'pin.create.place')).toBe(true)
    expect(can('moderator', 'event.markOfficial')).toBe(true)
    expect(can('moderator', 'pin.moderate')).toBe(true)
    expect(can('moderator', 'pin.makePermanent')).toBe(true)
    expect(can('moderator', 'pin.extendTime')).toBe(true)
    expect(can('moderator', 'users.manage')).toBe(false)
  })

  it('admin puede todo, incluido hacer permanente y gestionar usuarios', () => {
    expect(can('admin', 'forum.postOfficial')).toBe(true)
    expect(can('admin', 'pin.makePermanent')).toBe(true)
    expect(can('admin', 'users.manage')).toBe(true)
    expect(can('admin', 'pin.create.place')).toBe(true)
  })
})

describe('isUdpEmail — solo comunidad UDP', () => {
  it('acepta @mail.udp.cl (case-insensitive)', () => {
    expect(isUdpEmail('nombre.apellido@mail.udp.cl')).toBe(true)
    expect(isUdpEmail('ALGUIEN@MAIL.UDP.CL')).toBe(true)
  })
  it('rechaza otros dominios (incluidos parecidos)', () => {
    expect(isUdpEmail('alguien@gmail.com')).toBe(false)
    expect(isUdpEmail('alguien@udp.cl')).toBe(false)
    expect(isUdpEmail('alguien@fakemail.udp.cl.evil.com')).toBe(false)
  })
})
