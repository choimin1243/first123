import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { students, classId, section } = await request.json();

        // 타입 검증
        if (!classId || !students || !Array.isArray(students)) {
            return NextResponse.json({
                error: 'Invalid request data. classId and students array are required.'
            }, { status: 400 });
        }

        // classId를 정수로 변환
        const classIdInt = parseInt(classId, 10);
        const sectionInt = parseInt(section || '1', 10);

        if (isNaN(classIdInt) || isNaN(sectionInt)) {
            return NextResponse.json({
                error: 'classId and section must be valid numbers.'
            }, { status: 400 });
        }

        // class가 존재하는지 확인
        const classCheck = await sql`SELECT id FROM classes WHERE id = ${classIdInt}`;
        if (classCheck.length === 0) {
            return NextResponse.json({
                error: `Class with id ${classIdInt} does not exist.`
            }, { status: 404 });
        }

        // 기존 학생 데이터 삭제
        await sql`DELETE FROM students WHERE class_id = ${classIdInt} AND section_number = ${sectionInt}`;

        // 새로운 학생 데이터 삽입
        console.log('💾 저장할 학생 데이터:', students.map(s => ({
            name: s.name,
            group_name: s.group_name,
            is_underachiever: s.is_underachiever,
            is_special_class: s.is_special_class,
            is_problem_student: s.is_problem_student
        })));

        for (const student of students) {
            await sql`INSERT INTO students (class_id, section_number, name, gender, is_problem_student, is_special_class, group_name, rank, birth_date, contact, notes, is_underachiever)
                     VALUES (${classIdInt}, ${sectionInt}, ${student.name}, ${student.gender}, ${student.is_problem_student || false}, ${student.is_special_class || false}, ${student.group_name || null}, ${student.rank || null}, ${student.birth_date || null}, ${student.contact || null}, ${student.notes || null}, ${student.is_underachiever || false})`;
        }

        return NextResponse.json({ success: true, count: students.length });
    } catch (error) {
        console.error('Error creating students:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Failed to create students',
            details: errorMessage
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const classId = searchParams.get('classId');
        const section = searchParams.get('section');

        if (!classId) {
            return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }

        let students;

        if (section) {
            students = await sql`SELECT * FROM students WHERE class_id = ${classId} AND section_number = ${section} ORDER BY id`;
        } else {
            students = await sql`SELECT * FROM students WHERE class_id = ${classId} ORDER BY id`;
        }

        return NextResponse.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { id } = await request.json();

        await sql`DELETE FROM students WHERE id = ${id}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting student:', error);
        return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
    }
}
