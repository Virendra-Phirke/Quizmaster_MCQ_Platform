export type QuestionType = 'mcq' | 'true_false' | 'short_answer';

export interface BaseQuestion {
    id: string;
    question: string;
    marks: number;
    section?: string;
    type: QuestionType;
}

export interface MCQQuestion extends BaseQuestion {
    type: 'mcq' | 'true_false'; // True/False is essentially a restricted MCQ
    options: string[];
    correctAnswer: number; // Index of the correct option
}

export interface ShortAnswerQuestion extends BaseQuestion {
    type: 'short_answer';
    correctAnswer: string; // The text answer
}

export type Question = MCQQuestion | ShortAnswerQuestion;

// Helper to check if a question is MCQ-like (has options)
export const isMCQ = (q: Question): q is MCQQuestion => {
    return !q.type || q.type === 'mcq' || q.type === 'true_false';
};

// Helper for default empty question
export const createDefaultQuestion = (id: string, type: QuestionType = 'mcq'): Question => {
    if (type === 'short_answer') {
        return {
            id,
            type: 'short_answer',
            question: '',
            marks: 1,
            section: 'General',
            correctAnswer: ''
        };
    }

    if (type === 'true_false') {
        return {
            id,
            type: 'true_false',
            question: '',
            marks: 1,
            section: 'General',
            options: ['True', 'False'],
            correctAnswer: 0
        };
    }

    return {
        id,
        type: 'mcq',
        question: '',
        marks: 1,
        section: 'General',
        options: ['', '', '', ''],
        correctAnswer: 0
    };
};
