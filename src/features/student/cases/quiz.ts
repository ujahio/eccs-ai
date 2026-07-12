import type { StudentCaseQuizQuestion } from "./student-case";

export function shuffleStudentCaseQuizQuestions(
	questions: StudentCaseQuizQuestion[],
	seed: string,
) {
	const shuffled = [...questions];
	let state = seedNumber(seed);

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		state = nextSeedState(state);
		const swapIndex = state % (index + 1);
		const current = shuffled[index];
		const swap = shuffled[swapIndex];

		if (current && swap) {
			shuffled[index] = swap;
			shuffled[swapIndex] = current;
		}
	}

	return shuffled;
}

export function quizOptionLabel(index: number) {
	return String.fromCharCode(65 + index);
}

function seedNumber(seed: string) {
	let hash = 2166136261;

	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

function nextSeedState(state: number) {
	return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
