import { Body, Controller, Headers, Ip, Post } from '@nestjs/common';
import { CreateContactMessageDto } from './dto/contact-messages.dto';
import { ContactMessagesService } from './contact-service.service';

@Controller('contact-messages')
export class ContactMessagesController {
  constructor(private readonly service: ContactMessagesService) {}

  @Post()
  async create(
    @Body() dto: CreateContactMessageDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.service.create({ ...dto, ip, userAgent: ua });
  }
}
