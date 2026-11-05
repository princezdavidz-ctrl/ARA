import { Body,Controller,Post,Req,UseGuards } from '@nestjs/common';
import { AnswerService } from '../rag/answer.service';
import { answerSchema } from '../rag/contracts';
import { AuthGuard,AraUser } from '../platform/auth.guard';
@Controller('answer')
@UseGuards(AuthGuard)
export class AnswerController {
  constructor(private answers:AnswerService){}
  @Post() answer(@Req() req:{user:AraUser},@Body() body:unknown){return this.answers.answer(answerSchema.parse(body),req.user.agencyId);}
}
