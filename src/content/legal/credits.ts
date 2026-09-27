import type { Language } from '../../types'

/**
 * Credits text from the Unity Menu scene (CreditText) and
 * MENSAJE_CREDITOS.md short UI versions.
 */
const CREDITS_ES = `Memory History

Creador y Programador
Iván R. Moros Sánchez

Soporte Técnico
Diego D. Cabrera Rojas

Diseño Gráfico e Ilustración
Irene Sánchez López

Un pequeño juego de memoria sobre mucha historia`

const CREDITS_EN = `Memory History

Creator, Designer and Programmer
Iván R. Moros Sánchez

Technical Support and Distribution
Diego D. Cabrera Rojas

Graphic Design and Illustration
Irene Sánchez López

A little memory game about a lot of history`

export function creditsText(language: Language): string {
  return language === 'en' ? CREDITS_EN : CREDITS_ES
}
